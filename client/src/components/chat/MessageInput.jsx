import React, { useRef, useState, useEffect } from 'react';
import { Send, Paperclip, Smile, X, FileText, Loader2, Mic, Trash2, Pause, Play } from 'lucide-react';
import { useAudioRecorder, formatAudioDuration } from '../../hooks/useAudioRecorder';

const MessageInput = ({
  value = '',
  onChange = () => { },
  onSubmit = () => { },
  onSendAudio = () => { },
  placeholder = 'Type a message...',
  disabled = false,
  selectedFiles = [],
  onFilesSelect = () => { },
  onFileRemove = () => { },
  isUploading = false,
  uploadProgress = 0,
}) => {
  const fileInputRef = useRef(null);

  // Audio Recording Hook (Phase 9)
  const {
    isRecording,
    isPaused,
    duration,
    formattedDuration,
    waveformBars,
    previewAudioUrl,
    recordedWaveform,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder();

  // Review Mode Audio Preview State
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const previewAudioRef = useRef(null);
  const previewProgressRef = useRef(null);
  const isPreviewDraggingRef = useRef(false);

  // Fluid pointer drag-to-seek preview scrubbing
  const calculatePreviewSeek = (clientX) => {
    if (!previewProgressRef.current || !previewAudioRef.current || !duration) return;
    const rect = previewProgressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    previewAudioRef.current.currentTime = newTime;
    setPreviewTime(newTime);
  };

  const handlePreviewPointerDown = (e) => {
    isPreviewDraggingRef.current = true;
    calculatePreviewSeek(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handlePreviewPointerMove = (e) => {
    if (!isPreviewDraggingRef.current) return;
    calculatePreviewSeek(e.clientX);
  };

  const handlePreviewPointerUp = (e) => {
    if (isPreviewDraggingRef.current) {
      isPreviewDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
    }
  };

  // Listen to Global Audio Singleton to pause preview if another audio plays
  useEffect(() => {
    const handleGlobalAudioPlay = (e) => {
      if (e.detail?.activeUrl !== previewAudioUrl && isPreviewPlaying) {
        previewAudioRef.current?.pause();
        setIsPreviewPlaying(false);
      }
    };
    window.addEventListener('txtro:audio-play', handleGlobalAudioPlay);
    return () => window.removeEventListener('txtro:audio-play', handleGlobalAudioPlay);
  }, [previewAudioUrl, isPreviewPlaying]);

  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      window.dispatchEvent(
        new CustomEvent('txtro:audio-play', { detail: { activeUrl: previewAudioUrl } })
      );
      previewAudioRef.current.play().catch((e) => console.error(e));
      setIsPreviewPlaying(true);
    }
  };

  const handleResumeRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewTime(0);
    resumeRecording();
  };

  const handleCancelRecording = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewTime(0);
    cancelRecording();
  };

  const handleStartRecording = async (e) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    await startRecording();
  };

  const handleFinishAndSendAudio = async () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewTime(0);

    const result = await stopRecording();
    if (result && result.audioFile) {
      onSendAudio(result.audioFile, result.duration, result.waveform);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || selectedFiles.length > 0) && !isUploading) {
        onSubmit(e);
      }
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelect(files);
    }
    // Reset input value so selecting same file again triggers onChange
    e.target.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0 transition-colors duration-200">
      {/* File Attachment Staging Preview Dock */}
      {selectedFiles.length > 0 && (
        <div className="px-4 pt-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
            </span>
            <button
              type="button"
              onClick={() => onFileRemove('all')}
              disabled={isUploading}
              className="text-[11px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer font-medium"
            >
              Clear all
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-h-32 flex-wrap">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative group rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700/80 shadow-xs"
              >
                {file.type?.startsWith('image/') ? (
                  <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center p-1">
                    <FileText size={18} />
                    <span className="text-[9px] truncate max-w-[48px] mt-0.5 font-medium">{file.name}</span>
                  </div>
                )}

                {/* Floating Remove 'X' Badge */}
                <button
                  type="button"
                  onClick={() => onFileRemove(idx)}
                  disabled={isUploading}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-sm"
                  title="Remove"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isRecording ? (
          isPaused ? (
            /* --- 1. REVIEW & PREVIEW DOCK --- */
            <div className="flex items-center gap-2.5 w-full h-11 px-1 animate-in fade-in duration-200">
              {/* Hidden preview audio element */}
              <audio
                ref={previewAudioRef}
                src={previewAudioUrl || ''}
                onTimeUpdate={() => {
                  if (previewAudioRef.current) setPreviewTime(previewAudioRef.current.currentTime);
                }}
                onEnded={() => {
                  setIsPreviewPlaying(false);
                  setPreviewTime(0);
                }}
              />

              {/* Discard Recording */}
              <button
                type="button"
                onClick={handleCancelRecording}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer shrink-0"
                title="Discard recording"
              >
                <Trash2 size={18} />
              </button>

              {/* Play / Pause Preview Button */}
              <button
                type="button"
                onClick={togglePreviewPlay}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
                title={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
              >
                {isPreviewPlaying ? <Pause size={15} className="fill-current" /> : <Play size={15} className="fill-current ml-0.5" />}
              </button>

              {/* Recorded Waveform Scrubber */}
              <div
                ref={previewProgressRef}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerUp}
                onPointerCancel={handlePreviewPointerUp}
                className="flex-1 flex items-center justify-center gap-[3px] h-10 px-3 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 cursor-pointer overflow-hidden touch-none select-none"
                title="Drag or click to seek"
              >
                {(recordedWaveform.length > 0 ? recordedWaveform : waveformBars).map((level, idx) => {
                  const barRatio = (idx / 27) * 100;
                  const progressPercent = duration > 0 ? (previewTime / duration) * 100 : 0;
                  const isPlayed = barRatio <= progressPercent;

                  return (
                    <span
                      key={idx}
                      style={{ height: `${Math.max(4, Math.round((level / 100) * 24))}px` }}
                      className={`w-[3px] rounded-full transition-colors duration-100 shrink-0 ${
                        isPlayed
                          ? 'bg-indigo-600 dark:bg-indigo-400'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Duration indicator */}
              <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300 min-w-[34px] select-none text-right">
                {isPreviewPlaying ? formatAudioDuration(previewTime) : formattedDuration}
              </span>

              {/* Resume Recording Button */}
              <button
                type="button"
                onClick={handleResumeRecording}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200/60 dark:border-rose-900/40 transition-all cursor-pointer shrink-0"
                title="Resume recording"
              >
                <Mic size={18} />
              </button>

              {/* Send Voice Note Button */}
              <button
                type="button"
                onClick={handleFinishAndSendAudio}
                disabled={disabled || isUploading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                title="Send voice note"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin text-white" /> : <Send size={18} />}
              </button>
            </div>
          ) : (
            /* --- 2. LIVE RECORDING DOCK --- */
            <div className="flex items-center gap-2.5 w-full h-11 px-1 animate-in fade-in duration-200">
              {/* Discard / Cancel Button */}
              <button
                type="button"
                onClick={handleCancelRecording}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer shrink-0"
                title="Discard recording"
              >
                <Trash2 size={18} />
              </button>

              {/* Live Recording Indicator: Blinking Red Dot + Stopwatch Timer */}
              <div className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500/50 shrink-0" />
                <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400 min-w-[34px] select-none">
                  {formattedDuration}
                </span>
              </div>

              {/* Dancing Waveform Visualizer */}
              <div className="flex-1 flex items-center justify-center gap-[3px] h-10 px-3 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                {waveformBars.map((level, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.max(4, Math.round((level / 100) * 24))}px` }}
                    className="w-[3px] bg-rose-500 dark:bg-rose-400 rounded-full transition-all duration-75 shrink-0"
                  />
                ))}
              </div>

              {/* Pause Recording Button (Enter Review Mode) */}
              <button
                type="button"
                onClick={pauseRecording}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0"
                title="Pause and review"
              >
                <Pause size={17} />
              </button>

              {/* Send Voice Note Button */}
              <button
                type="button"
                onClick={handleFinishAndSendAudio}
                disabled={disabled || isUploading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                title="Send voice note"
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin text-white" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          )
        ) : (
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            {/* Hidden File Input with 'multiple' enabled */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.tar,.gz,.webm,.mp3,.wav,.ogg"
              className="hidden"
            />

            {/* Attachment & Emoji actions */}
            <div className="flex items-center text-slate-400">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
                title="Attach files"
                tabIndex={-1}
              >
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                disabled={disabled || isUploading}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer disabled:opacity-50"
                title="Insert emoji"
                tabIndex={-1}
              >
                <Smile size={18} />
              </button>
            </div>

            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                disabled={disabled || isUploading}
                placeholder={selectedFiles.length > 0 ? 'Add a caption...' : placeholder}
                className="w-full h-11 px-4 text-sm font-medium text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
              />
            </div>

            {/* Dynamic Send / Mic Action Button */}
            {value.trim() || selectedFiles.length > 0 ? (
              <button
                type="submit"
                disabled={disabled || isUploading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer shrink-0"
                title="Send message"
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin text-white" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={disabled || isUploading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer shrink-0"
                title="Record voice note"
              >
                <Mic size={18} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
