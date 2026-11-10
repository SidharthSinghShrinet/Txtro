import imageCompression from "browser-image-compression";
import { apiInstance } from "../api/axiosInstance";

/**
 * Compresses an image file on the client using a Web Worker.
 * Preserves documents, audio, etc., without compression.
 */
export const compressImageIfNeeded = async (file) => {
    if (!file.type.startsWith("image/")) {
        return file;   // Documents and audio pass through uncompressed
    }

    // If it's a GIF or SVG, don't compress (compression can break animated frames/vector paths)
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
        return file;
    }

    const options = {
        maxSizeMB: 0.4,  // Max size: ~400 KB
        maxWidthOrHeight: 1600,  // Max dimension: 1600px (crisp for all phone and desktop screens)
        useWebWorker: true,  // Offloads compression to a background thread (zero UI stutter)
        fileType: 'image/webp',  // Converts to modern high-efficiency WebP
    };

    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.log("Image compression fallback: using original file", error);
        return file;
    }
};

/**
 * Uploads a single file stream via XMLHttpRequest to track live byte progress.
 */
const uploadSingleFileWithProgress = (url, file, mimeType, onProgress, registerXhr) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (registerXhr) registerXhr(xhr);

        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", mimeType);

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress(event.loaded, event.total);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Cloud upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error during cloud upload"));
        xhr.onabort = () => reject(new Error("Upload aborted by user"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.send(file);
    });
};

/**
 * Uploads multiple files directly to Oracle Cloud Infrastructure (OCI) via Pre-Signed URLs.
 * Completely parallelized, tracks overall aggregate progress, and supports instant cancellation!
 * 
 * @param {File[]} files - Array of files to upload
 * @param {Function} onOverallProgress - Callback receiving overall percentage (0 - 100)
 * @param {Function} onRegisterAbort - Callback receiving an abort trigger function
 * @returns {Promise<Array<{ fileUrl: string, fileName: string, fileSize: number, mimeType: string }>>}
 */
export const uploadFilesDirectlyToCloud = async (files = [], onOverallProgress = () => { }, onRegisterAbort = () => { }) => {
    if (!files || files.length === 0) return { attachments: [], uploadIntentId: null };

    const activeXhrs = [];
    const completedKeys = [];
    let isCancelled = false;
    let currentUploadIntentId = null;

    // Provide abort hook to caller
    onRegisterAbort(() => {
        isCancelled = true;
        // 1. Cut all active in-flight network streams immediately
        activeXhrs.forEach((xhr) => {
            try { xhr.abort(); } catch { }
        });

        // 2. Tell backend to purge any files that already reached OCI
        if (currentUploadIntentId || completedKeys.length > 0) {
            apiInstance.post("/messages/abort-upload", {
                uploadIntentId: currentUploadIntentId,
                keys: completedKeys
            }).catch((err) => console.error("Failed to notify server of aborted upload:", err));
        }
    });

    // 1. Compress all images in parallel on client threads
    const processedFiles = await Promise.all(files.map((file) => compressImageIfNeeded(file)));

    // 2. Request all Pre-Signed URLs in a single batch API call
    const filesMetaData = processedFiles.map((pf, idx) => ({
        fileName: pf.name || files[idx].name,
        fileType: pf.type || files[idx].type,
    }));

    const { data: uploadTicketsResponse } = await apiInstance.post("/messages/upload-url", {
        files: filesMetaData,
    });

    // Extract uploadIntentId and tickets from the new response format
    const responsePayload = uploadTicketsResponse?.data || {};
    currentUploadIntentId = responsePayload.uploadIntentId || null;
    const rawTickets = responsePayload.tickets || [];

    const tickets = Array.isArray(rawTickets) ? rawTickets : [rawTickets];

    // Check if user clicked cancel while compression or tickets request was ongoing
    if (isCancelled) {
        if (currentUploadIntentId) {
            apiInstance.post("/messages/abort-upload", {
                uploadIntentId: currentUploadIntentId,
                keys: []
            }).catch(() => { })
        }
        throw new Error("Upload aborted by user");
    }

    // 3. Track aggregate bytes across all concurrent files
    const totalBytesPerFile = processedFiles.map((f) => f.size);
    const loadedBytesPerFile = new Array(processedFiles.length).fill(0);
    const totalAggregateBytes = totalBytesPerFile.reduce((acc, curr) => acc + curr, 0);

    const updateAggregateProgress = (fileIdx, loaded) => {
        loadedBytesPerFile[fileIdx] = loaded;
        const currentTotalLoaded = loadedBytesPerFile.reduce((acc, curr) => acc + curr, 0);
        const percent = totalAggregateBytes > 0
            ? Math.round((currentTotalLoaded / totalAggregateBytes) * 100)
            : 0;
        onOverallProgress(Math.min(percent, 99)); // Cap at 99% until fully verified
    };

    // 4. Stream all files directly to Oracle Cloud with live progress
    await Promise.all(
        tickets.map(async (ticket, idx) => {
            if (isCancelled) return Promise.reject(new Error("Upload aborted by user"));
            const fileToUpload = processedFiles[idx];
            await uploadSingleFileWithProgress(
                ticket.presignedUrl,
                fileToUpload,
                fileToUpload.type || files[idx].type,
                (loaded) => updateAggregateProgress(idx, loaded),
                (xhr) => activeXhrs.push(xhr)
            );
            // 👈 ADD THIS: Track key when this specific file completes
            if (ticket.objectKey) {
                completedKeys.push(ticket.objectKey)
            }
        })
    );

    onOverallProgress(100);

    // 5. Return clean attachments array matching Mongoose Schema
    const attachments = tickets.map((ticket, idx) => ({
        fileUrl: ticket.publicFileUrl || ticket.fileUrl,
        fileName: files[idx].name,
        fileSize: processedFiles[idx].size,
        mimeType: processedFiles[idx].type || files[idx].type,
    }));

    // 👈 Return both attachments and the intent id
    return {
        attachments,
        uploadIntentId: currentUploadIntentId,
    };
};
