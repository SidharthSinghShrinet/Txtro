import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { Send, Paperclip, Smile, X, FileText, Loader2, Mic, Trash2, Pause, Play, Reply, Image as ImageIcon, Pencil, Check, Globe, ExternalLink } from 'lucide-react';
import { useAudioRecorder, formatAudioDuration } from '../../hooks/useAudioRecorder';
import { getLinkPreviewApi } from '../../api/api';

// Lazy-loaded Emoji Picker (0 KB initial bundle footprint + hover prefetch)
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const prefetchEmojiPicker = () => {
  import('emoji-picker-react');
};

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
  replyingTo = null,
  onCancelReply = () => { },
  editingMessage = null,
  onCancelEdit = () => { },
  currentUserId = null,
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

  // Full Emoji Picker Popover State (Phase 10)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const textInputRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiButtonRef.current?.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showEmojiPicker]);

  // Auto-focus input when a message is selected for reply (Phase 11)
  useEffect(() => {
    if (replyingTo) {
      textInputRef.current?.focus();
    }
  }, [replyingTo]);

  // Auto-focus input & position cursor at end when editing a message (Phase 13)
  useEffect(() => {
    if (editingMessage && textInputRef.current) {
      textInputRef.current.focus();
      const len = textInputRef.current.value?.length || 0;
      textInputRef.current.setSelectionRange(len, len);
    }
  }, [editingMessage]);

  // Auto-resize textarea height as content wraps or expands with Shift+Enter
  useEffect(() => {
    if (textInputRef.current) {
      textInputRef.current.style.height = 'auto';
      const scrollHeight = textInputRef.current.scrollHeight;
      // Cap at 140px (~5 lines); hide scrollbar completely until it exceeds cap
      if (scrollHeight > 140) {
        textInputRef.current.style.height = '140px';
        textInputRef.current.style.overflowY = 'auto';
      } else {
        textInputRef.current.style.height = `${Math.max(scrollHeight, 24)}px`;
        textInputRef.current.style.overflowY = 'hidden';
      }
    }
  }, [value]);

  // Live Link Preview Pre-Flight State (Phase 14 - Pattern 2 WhatsApp Standard)
  const [inputLinkPreview, setInputLinkPreview] = useState(null);
  const [isLinkPreviewDismissed, setIsLinkPreviewDismissed] = useState(false);
  const detectedUrlRef = useRef(null);
  const previewDebounceRef = useRef(null);

  // Live URL detection & debounced pre-flight link preview
  useEffect(() => {
    const urlMatch = value ? value.match(/https?:\/\/[^\s]+/i) : null;
    const currentUrl = urlMatch ? urlMatch[0].replace(/[.,!?;:)]+$/, '') : null;

    // If URL was removed from input, clear preview state
    if (!currentUrl) {
      setInputLinkPreview(null);
      setIsLinkPreviewDismissed(false);
      detectedUrlRef.current = null;
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
      return;
    }

    // If URL changed to a different link, reset dismissal so new link can be previewed
    if (detectedUrlRef.current !== currentUrl) {
      detectedUrlRef.current = currentUrl;
      setIsLinkPreviewDismissed(false);
      setInputLinkPreview(null);
    }

    // If user dismissed this specific URL preview, do not fetch or show
    if (isLinkPreviewDismissed) return;

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      try {
        const res = await getLinkPreviewApi(currentUrl);
        if (res?.data?.data) {
          setInputLinkPreview(res.data.data);
        } else {
          setInputLinkPreview(null);
        }
      } catch {
        setInputLinkPreview(null);
      }
    }, 350);

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [value, isLinkPreviewDismissed]);

  // Insert emoji at cursor position
  const handleEmojiSelect = (emojiData) => {
    const emoji = emojiData.emoji;
    if (!emoji) return;

    if (textInputRef.current) {
      const start = textInputRef.current.selectionStart ?? value.length;
      const end = textInputRef.current.selectionEnd ?? value.length;
      const updated = value.slice(0, start) + emoji + value.slice(end);
      onChange({ target: { value: updated } });

      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.setSelectionRange(start + emoji.length, start + emoji.length);
        }
      }, 0);
    } else {
      onChange({ target: { value: value + emoji } });
    }
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

  const handleFormSubmit = (e) => {
    e?.preventDefault?.();
    if (!disabled && (value.trim() || selectedFiles.length > 0) && !isUploading) {
      setShowEmojiPicker(false);
      const linkPreviewPayload = {
        linkPreview: isLinkPreviewDismissed ? null : inputLinkPreview,
        linkPreviewDismissed: isLinkPreviewDismissed,
      };
      // Clear preview state
      setInputLinkPreview(null);
      setIsLinkPreviewDismissed(false);
      detectedUrlRef.current = null;
      onSubmit(e, linkPreviewPayload);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (editingMessage) {
        e.preventDefault();
        onCancelEdit();
        return;
      }
      if (replyingTo) {
        e.preventDefault();
        onCancelReply();
        return;
      }
      if (inputLinkPreview) {
        e.preventDefault();
        setIsLinkPreviewDismissed(true);
        setInputLinkPreview(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
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
    <div className="relative border-t border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md shrink-0 transition-colors duration-200">
      {/* Full Emoji Picker Popover Modal (Phase 10) */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-3 sm:left-6 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150"
        >
          <Suspense
            fallback={
              <div className="w-[310px] sm:w-[330px] h-[380px] bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <span className="text-xs font-medium">Loading emojis...</span>
              </div>
            }
          >
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              theme={
                typeof document !== 'undefined' &&
                document.documentElement.classList.contains('dark')
                  ? 'dark'
                  : 'light'
              }
              searchPlaceHolder="Search all 3,600+ emojis..."
              width={320}
              height={380}
              lazyLoadEmojis={true}
              previewConfig={{ showPreview: false }}
            />
          </Suspense>
        </div>
      )}
      {/* Floating Edit Message Mode Banner (Phase 13) */}
      {editingMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50/90 dark:bg-indigo-950/70 border-b border-indigo-200/80 dark:border-indigo-800/60 text-xs animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0 border-l-3 border-indigo-600 dark:border-indigo-400 pl-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Pencil size={13} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                Editing message
              </div>
              <div className="text-slate-600 dark:text-slate-300 truncate mt-0.5 max-w-xs sm:max-w-md">
                {editingMessage.message}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Cancel editing (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {/* WhatsApp-Style Input Dock Pre-Flight Link Preview Banner (Phase 14) */}
      {inputLinkPreview && !isLinkPreviewDismissed && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-100/95 dark:bg-slate-800/95 border-b border-slate-200/80 dark:border-slate-700/80 text-xs animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0 border-l-3 border-indigo-600 dark:border-indigo-400 pl-2.5">
            {inputLinkPreview.image ? (
              <img
                src={inputLinkPreview.image}
                alt={inputLinkPreview.title || 'Preview'}
                className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center shrink-0 text-indigo-500">
                <Globe size={18} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs max-w-xs sm:max-w-md">
                {inputLinkPreview.title || inputLinkPreview.url}
              </div>
              {inputLinkPreview.description && (
                <div className="text-slate-500 dark:text-slate-400 truncate text-[11px] mt-0.5 max-w-xs sm:max-w-md">
                  {inputLinkPreview.description}
                </div>
              )}
              <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 text-[10.5px] lowercase tracking-wide mt-1">
                <Globe size={10} className="shrink-0" />
                <span className="truncate">{inputLinkPreview.url || inputLinkPreview.siteName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLinkPreviewDismissed(true);
              setInputLinkPreview(null);
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Remove link preview"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {/* Floating Quoted Message Reply Dock (Phase 11) */}
      {replyingTo && (() => {
        const replyingSenderId = (replyingTo.senderId?._id || replyingTo.senderId)?.toString();
        const isReplyingToSelf = currentUserId && replyingSenderId === currentUserId.toString();
        const replyingAuthor = isReplyingToSelf
          ? 'yourself'
          : (replyingTo.senderId?.fullname || replyingTo.senderId?.username || replyingTo.senderName || 'user');

        return (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-700/80 text-xs animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0 border-l-3 border-indigo-600 dark:border-indigo-400 pl-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                  <Reply size={13} className="shrink-0" />
                  <span className="truncate">Replying to {replyingAuthor}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate mt-0.5 max-w-xs sm:max-w-md">
                  {replyingTo.messageType === 'image' && (
                    <>
                      <ImageIcon size={13} className="shrink-0 text-slate-500" />
                      <span>Photo</span>
                    </>
                  )}
                  {replyingTo.messageType === 'audio' && (
                    <>
                      <Mic size={13} className="shrink-0 text-slate-500" />
                      <span>Voice message</span>
                    </>
                  )}
                  {replyingTo.messageType === 'document' && (
                    <>
                      <FileText size={13} className="shrink-0 text-slate-500" />
                      <span className="truncate">{replyingTo.attachments?.[0]?.fileName || 'Document'}</span>
                    </>
                  )}
                  {(replyingTo.messageType === 'text' || !replyingTo.messageType || replyingTo.message) && (
                    <span className="truncate">{replyingTo.message || 'Media'}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {replyingTo.attachments?.[0]?.fileUrl && replyingTo.messageType === 'image' && (
                <img
                  src={replyingTo.attachments[0].fileUrl}
                  alt="thumb"
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              )}
              <button
                type="button"
                onClick={onCancelReply}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Cancel reply (Esc)"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

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
          <form onSubmit={handleFormSubmit} className="flex items-end gap-2 pb-0.5">
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
            <div className="flex items-center text-slate-400 mb-0.5">
              {!editingMessage && (
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
              )}
              <button
                ref={emojiButtonRef}
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                onMouseEnter={prefetchEmojiPicker}
                disabled={disabled || isUploading}
                className={`p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                  showEmojiPicker
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                }`}
                title="Insert emoji"
                tabIndex={-1}
              >
                <Smile size={18} />
              </button>
            </div>

            {/* Text Input (Outer pill wrapper prevents scrollbar clipping) */}
            <div className="flex-1 relative bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-[border-color,box-shadow] min-h-[44px] flex items-center px-4 py-2.5">
              <textarea
                ref={textInputRef}
                rows={1}
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                disabled={disabled || isUploading}
                placeholder={
                  editingMessage
                    ? 'Edit your message...'
                    : selectedFiles.length > 0
                    ? 'Add a caption...'
                    : placeholder
                }
                className="w-full resize-none bg-transparent outline-none border-0 p-0 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-relaxed block focus:ring-0"
              />
            </div>

            {/* Dynamic Send / Mic Action Button */}
            {value.trim() || selectedFiles.length > 0 ? (
              <button
                type="submit"
                disabled={disabled || isUploading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer shrink-0"
                title={editingMessage ? 'Save changes' : 'Send message'}
              >
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin text-white" />
                ) : editingMessage ? (
                  <Check size={18} strokeWidth={2.5} />
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
