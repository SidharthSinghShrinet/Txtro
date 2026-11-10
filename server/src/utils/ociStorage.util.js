import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

//& Initialize S3 Client configured for Oracle Cloud Infrastructure
let s3ClientInstance = null;

const getS3Client = () => {
    if (!s3ClientInstance) {
        s3ClientInstance = new S3Client({
            region: process.env.OCI_S3_REGION,
            endpoint: `https://${process.env.OCI_NAMESPACE}.compat.objectstorage.${process.env.OCI_S3_REGION}.oraclecloud.com`,
            credentials: {
                accessKeyId: process.env.OCI_S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.OCI_S3_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
    }
    return s3ClientInstance;
};


/**
 * Generate a pre-signed PUT URL for direct client-to-OCI upload
 * @param {string} originalFileName
 * @param {string} mimeType
 * @returns {Promise<{ presignedUrl: string, fileUrl: string, objectKey: string }>}
 */


export const generatePreSignedUploadUrl = async (originalFileName, mimeType) => {
    const s3 = getS3Client();

    //^ Generate unique object key: timestamp-random-cleanedName
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`;

    const command = new PutObjectCommand({
        Bucket: process.env.OCI_BUCKET_NAME,
        Key: uniqueKey,
        ContentType: mimeType
    })

    //^ 15-minute Expiration Window for Starting Upload (900 seconds)
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    //^ Public read URL for the stored object in OCI
    const publicFileUrl = `https://objectstorage.${process.env.OCI_S3_REGION}.oraclecloud.com/n/${process.env.OCI_NAMESPACE}/b/${process.env.OCI_BUCKET_NAME}/o/${encodeURIComponent(uniqueKey)}`;

    return {
        presignedUrl,
        publicFileUrl,
        objectKey: uniqueKey
    }
}

//! Before we are doing in this way only. But we got to know that @aws-sdk/client v3 does not support the multiple objects deletion without content MD5 in Request header.
//! So to resolve that either Install an extra crypto dependency: npm i @smithy/md5-js
//! Write a custom request middleware that intercepts the outgoing HTTP request, reads the raw XML string, computes a 128-bit MD5 digest, base64 encodes it, and injects the Content-MD5 header.

/**
 * Delete multiple objects in a single batch request from OCI
 * @param {string[]} objectKeys - Array of object keys to delete
 */

/*
export const deleteObjectsFromOCI = async (objectKeys = []) => {
    if (!objectKeys || objectKeys.length === 0) return null;
    const s3 = getS3Client();
    const command = new DeleteObjectsCommand({
        Bucket: process.env.OCI_BUCKET_NAME,
        Delete: {
            Objects: objectKeys.map((key) => ({ Key: key })),
            Quiet: true, //! Silently succeeds even if some keys does not exist
        }
    })
    return await s3.send(command);
}
    */

//! Second Way 
/**
 * Delete multiple objects in parallel from OCI (No Content-MD5 requirement!)
 * @param {string[]} objectKeys - Array of object keys to delete
 */

export const deleteObjectsFromOCI = async (objectKeys = []) => {
    if (!objectKeys || objectKeys.length === 0) return null;
    const s3 = getS3Client();
    // Execute DeleteObjectCommand in parallel across all keys
    return await Promise.all(
        objectKeys.map((key) => (
            s3.send(
                new DeleteObjectCommand({
                    Bucket: process.env.OCI_BUCKET_NAME,
                    Key: key
                })
            ).catch((err) => {
                // If a key doesn't exist in OCI, ignore safely (idempotent)
                return null;
            })
        ))
    )
}; 