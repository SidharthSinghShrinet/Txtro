import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Determine the most suitable supported audio MIME type across browsers
 */
const getAudioMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return { mimeType: '', extension: 'webm' };

    const candidates = [
        { mime: 'audio/webm;codecs=opus', ext: 'webm' },
        { mime: 'audio/webm', ext: 'webm' },
        { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
        { mime: 'audio/mp4', ext: 'm4a' },
        { mime: 'audio/aac', ext: 'aac' },
    ];

    for (const candidate of candidates) {
        if (MediaRecorder.isTypeSupported(candidate.mime)) {
            return { mimeType: candidate.mime, extension: candidate.ext };
        }
    }
    return { mimeType: '', extension: 'webm' };
};

/**
 * Formats seconds into MM:SS (e.g. 14 -> "0:14", 65 -> "1:05")
 */
export const formatAudioDuration = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Downsamples continuous raw volume peaks into exactly 28 representative bars
 * using peak-envelope extraction (captures true speech syllables & dynamic range).
 */
export const downsampleWaveformPeaks = (rawPeaks = [], targetCount = 28) => {
    if (!rawPeaks || rawPeaks.length === 0) {
        return new Array(targetCount).fill(20);
    }
    if (rawPeaks.length <= targetCount) {
        const result = [...rawPeaks];
        while (result.length < targetCount) {
            result.push(16);
        }
        return result;
    }
    const step = rawPeaks.length / targetCount;
    const sampled = [];
    for (let i = 0; i < targetCount; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let maxPeak = 0;
        for (let j = start; j < end; j++) {
            if (rawPeaks[j] > maxPeak) maxPeak = rawPeaks[j];
        }
        sampled.push(Math.max(12, Math.min(100, Math.round(maxPeak))));
    }
    return sampled;
};

/**
 * Custom React Hook: useAudioRecorder
 * Handles microphone capture, MediaRecorder streaming, real-time volume
 * waveform extraction (Web Audio API AnalyserNode), and duration tracking.
 */
export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [waveformBars, setWaveformBars] = useState([]);
    const [previewAudioUrl, setPreviewAudioUrl] = useState(null);
    const [recordedWaveform, setRecordedWaveform] = useState([]);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const rawPeaksRef = useRef([]);
    const previewAudioUrlRef = useRef(null);
    const pauseRecordingRef = useRef(null);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const pausedTimeRef = useRef(0);

    // Clean up all resources (Mic hardware stream, AudioContext, Nodes, RAF, Timers)
    const cleanupResources = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.disconnect(); } catch { }
            sourceNodeRef.current = null;
        }
        if (analyserRef.current) {
            try { analyserRef.current.disconnect(); } catch { }
            analyserRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                try {
                    track.stop();
                    track.enabled = false;
                } catch { }
            });
            streamRef.current = null;
        }
        if (previewAudioUrlRef.current) {
            URL.revokeObjectURL(previewAudioUrlRef.current);
            previewAudioUrlRef.current = null;
        }
        setPreviewAudioUrl(null);
        setRecordedWaveform([]);
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        rawPeaksRef.current = [];
    }, []);

    // Extract live voice loudness and push to animated waveform bars
    const trackVolume = useCallback(() => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average loudness across frequency bins
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / (dataArray.length || 1);

        // Normalize to a pleasant bar height percentage (12% baseline to 100% peak)
        const normalized = Math.min(100, Math.max(12, Math.round((average / 180) * 100)));

        // Record raw peak for true historical waveform persistence
        rawPeaksRef.current.push(normalized);

        setWaveformBars((prev) => {
            // Keep the last 28 samples for a continuous rolling visual wave
            const updated = [...prev, normalized];
            return updated.slice(-28);
        });

        animationFrameRef.current = requestAnimationFrame(trackVolume);
    }, []);

    // 1. START RECORDING
    const startRecording = useCallback(async () => {
        cleanupResources();
        rawPeaksRef.current = [];

        try {
            // Check browser support
            if (!navigator?.mediaDevices?.getUserMedia) {
                toast.error('Audio recording is not supported in this browser');
                return false;
            }

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            // Set up Web Audio API Analyser for live visual waveform
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // 32 frequency bins - fast & ultra-light on CPU
            analyser.smoothingTimeConstant = 0.65;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Configure MediaRecorder
            const { mimeType } = getAudioMimeType();
            const recorderOptions = mimeType ? { mimeType } : undefined;
            const recorder = new MediaRecorder(stream, recorderOptions);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            // Start recording in 200ms time-slices for responsive chunk collection
            recorder.start(200);

            // Initialize timing & visual states
            setIsRecording(true);
            setIsPaused(false);
            setDuration(0);
            setWaveformBars(new Array(16).fill(15)); // Pre-fill with gentle resting bars
            startTimeRef.current = Date.now();
            pausedTimeRef.current = 0;

            const MAX_RECORDING_SECONDS = 600; // 10-minute runaway recording limit

            // Precision stopwatch timer (accounts for elapsed time accurately)
            timerIntervalRef.current = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setDuration(elapsedSeconds);

                // Runaway recording safeguard
                if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
                    toast('Maximum 10-minute recording limit reached', { icon: '⏱️' });
                    pauseRecordingRef.current?.();
                }
            }, 500);

            // Start live waveform visualization
            trackVolume();
            return true;
        } catch (error) {
            console.error('Failed to start audio recording:', error);
            cleanupResources();
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                toast.error('Microphone access was denied. Please allow microphone permissions.');
            } else {
                toast.error('Could not access microphone.');
            }
            return false;
        }
    }, [cleanupResources, trackVolume]);

    // 2. STOP RECORDING (Returns audio File, duration in seconds, and blob URL)
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                cleanupResources();
                setIsRecording(false);
                setIsPaused(false);
                resolve(null);
                return;
            }

            const recordedSeconds = Math.max(1, duration);

            recorder.onstop = () => {
                const { mimeType, extension } = getAudioMimeType();
                const actualMime = recorder.mimeType || mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

                // Construct a native File object ready for direct-to-OCI upload
                const fileName = `voice-note-${Date.now()}.${extension}`;
                const audioFile = new File([audioBlob], fileName, {
                    type: actualMime,
                    lastModified: Date.now(),
                });

                const audioUrl = URL.createObjectURL(audioBlob);

                // Extract true 28 speech peaks from raw recording volume samples
                const finalWaveform = downsampleWaveformPeaks(rawPeaksRef.current, 28);

                cleanupResources();
                setIsRecording(false);
                setIsPaused(false);
                setDuration(0);
                setWaveformBars([]);

                resolve({
                    audioFile,
                    duration: recordedSeconds,
                    audioUrl,
                    mimeType: actualMime,
                    waveform: finalWaveform,
                });
            };

            // Request any remaining buffered audio bytes before stopping
            try {
                recorder.requestData();
            } catch {
                // Ignore if not supported in some older browsers
            }

            // Immediately stop hardware tracks so browser turns off recording indicator instantly
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => {
                    try {
                        track.stop();
                        track.enabled = false;
                    } catch { }
                });
            }

            recorder.stop();
        });
    }, [duration, cleanupResources]);

    // 3. CANCEL RECORDING (Discards recording and frees microphone instantly)
    const cancelRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null; // Do not trigger finish resolver
            try {
                recorder.stop();
            } catch { }
        }

        // Immediately stop hardware tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                try {
                    track.stop();
                    track.enabled = false;
                } catch { }
            });
        }

        cleanupResources();
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        setWaveformBars([]);
    }, [cleanupResources]);

    // 4. PAUSE RECORDING (Generates preview audio blob & recorded waveform)
    const pauseRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            try { recorder.requestData(); } catch { }
            recorder.pause();
            setIsPaused(true);

            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Create temporary preview audio from chunks recorded so far
            const { mimeType } = getAudioMimeType();
            const actualMime = recorder.mimeType || mimeType || 'audio/webm';
            const previewBlob = new Blob(audioChunksRef.current, { type: actualMime });
            if (previewAudioUrlRef.current) {
                URL.revokeObjectURL(previewAudioUrlRef.current);
            }
            const previewUrl = URL.createObjectURL(previewBlob);
            previewAudioUrlRef.current = previewUrl;
            setPreviewAudioUrl(previewUrl);

            // Compute recorded waveform peaks so far
            setRecordedWaveform(downsampleWaveformPeaks(rawPeaksRef.current, 28));
        }
    }, []);

    pauseRecordingRef.current = pauseRecording;

    // 5. RESUME RECORDING
    const resumeRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'paused') {
            if (previewAudioUrlRef.current) {
                URL.revokeObjectURL(previewAudioUrlRef.current);
                previewAudioUrlRef.current = null;
            }
            setPreviewAudioUrl(null);

            recorder.resume();
            setIsPaused(false);
            startTimeRef.current = Date.now() - duration * 1000;
            const MAX_RECORDING_SECONDS = 600;

            timerIntervalRef.current = setInterval(() => {
                const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setDuration(elapsedSeconds);

                if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
                    toast('Maximum 10-minute recording limit reached', { icon: '⏱️' });
                    pauseRecordingRef.current?.();
                }
            }, 500);
            trackVolume();
        }
    }, [duration, trackVolume]);

    // Ensure hardware tracks are freed if user unmounts or navigates away
    useEffect(() => {
        return () => {
            cleanupResources();
        };
    }, [cleanupResources]);

    return {
        isRecording,
        isPaused,
        duration,
        formattedDuration: formatAudioDuration(duration),
        waveformBars,
        previewAudioUrl,
        recordedWaveform,
        startRecording,
        stopRecording,
        cancelRecording,
        pauseRecording,
        resumeRecording,
    };
};

