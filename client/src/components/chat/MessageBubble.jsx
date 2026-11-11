import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { Check, CheckCheck, FileText, Download, Clock, AlertCircle, X, Smile, Plus, Loader2, Reply, Image as ImageIcon, Mic } from 'lucide-react';
import VoiceNotePlayer from './VoiceNotePlayer';

// Lazy-loaded full emoji picker for custom reactions (WhatsApp-style '+' button)
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageBubble = ({
  messageId = null,
  message = '',
  createdAt = new Date(),
  isOutgoing = false,
  status = 'sent',
  messageType = 'text',
  attachments = [],
  reactions = [],
  replyTo = null,
  replySnapshot = null,
  isHighlighted = false,
  currentUserId = null,
  onToggleReaction = () => { },
  onSelectReply = () => { },
  onJumpToMessage = () => { },
  uploadProgress = 0,
  onCancelUpload = () => { },
  onImageClick = () => { },
}) => {
  const [showReactionDock, setShowReactionDock] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const dockRef = useRef(null);
  const fullPickerRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  // Group reactions by emoji (e.g. { "❤️": { count: 2, hasUserReacted: true } })
  const reactionGroups = useMemo(() => {
    if (!Array.isArray(reactions) || reactions.length === 0) return {};
    return reactions.reduce((acc, curr) => {
      const emoji = curr.emoji;
      if (!emoji) return acc;
      if (!acc[emoji]) {
        acc[emoji] = {
          count: 0,
          hasUserReacted: false,
        };
      }
      acc[emoji].count += 1;
      const rUid = (curr.userId?._id || curr.userId)?.toString();
      if (currentUserId && rUid === currentUserId.toString()) {
        acc[emoji].hasUserReacted = true;
      }
      return acc;
    }, {});
  }, [reactions, currentUserId]);

  const userReaction = useMemo(() => {
    if (!Array.isArray(reactions) || !currentUserId) return null;
    const found = reactions.find(
      (r) => (r.userId?._id || r.userId)?.toString() === currentUserId.toString()
    );
    return found ? found.emoji : null;
  }, [reactions, currentUserId]);

  // Touch handlers for mobile long-press reaction dock (350ms hold) & swipe-to-reply
  const handleTouchStart = (e) => {
    if (e.touches?.[0]) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
    setIsSwiping(false);
    touchTimerRef.current = setTimeout(() => {
      setShowReactionDock(true);
    }, 350);
  };

  const handleTouchMove = (e) => {
    if (!e.touches?.[0]) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = Math.abs(currentY - touchStartYRef.current);

    // If swiping right on mobile
    if (deltaX > 15 && deltaY < 30) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
      setIsSwiping(true);
      setSwipeOffset(Math.min(deltaX * 0.4, 50));
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (swipeOffset >= 35) {
      onSelectReply();
    }
    setIsSwiping(false);
    setSwipeOffset(0);
  };

  // Close reaction dock & full picker when clicking/tapping outside
  useEffect(() => {
    if (!showReactionDock && !showFullPicker) return;
    const handleClickOutside = (e) => {
      const isInsideDock = dockRef.current && dockRef.current.contains(e.target);
      const isInsideFullPicker = fullPickerRef.current && fullPickerRef.current.contains(e.target);
      if (!isInsideDock && !isInsideFullPicker) {
        setShowReactionDock(false);
        setShowFullPicker(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showReactionDock, showFullPicker]);

  const handleCustomEmojiReact = (emojiData) => {
    const em = emojiData.emoji;
    if (!em) return;
    onToggleReaction(messageId, em);
    setShowFullPicker(false);
    setShowReactionDock(false);
  };

  const formatTime = (time) => {
    try {
      const date = new Date(time);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Separate image, audio, and document attachments
  const imageAttachments = attachments.filter((att) => att.mimeType?.startsWith('image/'));
  const audioAttachments = attachments.filter((att) => att.mimeType?.startsWith('audio/'));
  const docAttachments = attachments.filter(
    (att) => !att.mimeType?.startsWith('image/') && !att.mimeType?.startsWith('audio/')
  );

  const hasReactions = Object.keys(reactionGroups).length > 0;

  return (
    <div
      id={messageId ? `msg-${messageId}` : undefined}
      className={`relative group/msg flex w-full transition-all duration-300 ${hasReactions ? 'mb-4.5' : 'mb-2.5'
        } ${isOutgoing ? 'justify-end' : 'justify-start'}`}
    >
      <div
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
        className={`relative max-w-[88%] sm:max-w-[72%] flex items-center gap-1.5 ${isOutgoing ? 'flex-row' : 'flex-row-reverse'
          }`}
      >
        {/* Desktop Quick Action Buttons (Hover) */}
        {status !== 'sending' && (
          <div className="opacity-0 group-hover/msg:opacity-100 flex items-center gap-0.5 transition-opacity duration-150 shrink-0">
            <button
              type="button"
              onClick={onSelectReply}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs active:scale-90"
              title="Reply"
            >
              <Reply size={15} />
            </button>
            <button
              type="button"
              onClick={() => setShowReactionDock((prev) => !prev)}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs active:scale-90"
              title="React to message"
            >
              <Smile size={15} />
            </button>
          </div>
        )}

        {/* Floating Quick Reaction Dock */}
        {showReactionDock && (
          <div
            ref={dockRef}
            className={`absolute -top-10 ${isOutgoing ? 'right-0' : 'left-0'
              } z-30 flex items-center gap-1 px-2 py-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200/80 dark:border-slate-700/80 animate-in zoom-in-95 fade-in duration-150 select-none`}
          >
            {QUICK_REACTIONS.map((em) => {
              const isSelected = userReaction === em;
              return (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    onToggleReaction(messageId, em);
                    setShowReactionDock(false);
                    setShowFullPicker(false);
                  }}
                  className={`w-7 h-7 flex items-center justify-center text-lg hover:scale-130 active:scale-95 transition-transform cursor-pointer rounded-full ${isSelected
                    ? 'bg-indigo-100 dark:bg-indigo-950/80 ring-1 ring-indigo-500'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  title={`React ${em}`}
                >
                  {em}
                </button>
              );
            })}

            {/* '+' Button to open full emoji reaction picker */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullPicker((prev) => !prev);
              }}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${showFullPicker
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-115 active:scale-95'
                }`}
              title="More reactions"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {/* Full Emoji Picker Popover for Reactions */}
        {showFullPicker && (
          <div
            ref={fullPickerRef}
            className={`absolute bottom-full mb-3 ${isOutgoing ? 'right-0' : 'left-0'
              } z-40 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 animate-in fade-in zoom-in-95 duration-150`}
          >
            <Suspense
              fallback={
                <div className="w-[300px] sm:w-[320px] h-[360px] bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  <span className="text-xs font-medium">Loading reactions...</span>
                </div>
              }
            >
              <EmojiPicker
                onEmojiClick={handleCustomEmojiReact}
                theme={
                  typeof document !== 'undefined' &&
                    document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light'
                }
                searchPlaceHolder="Search reactions..."
                width={310}
                height={360}
                lazyLoadEmojis={true}
                previewConfig={{ showPreview: false }}
              />
            </Suspense>
          </div>
        )}

        {/* Message Bubble Card */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className={`rounded-2xl shadow-sm text-sm break-words relative transition-all overflow-hidden ${isHighlighted
            ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 animate-pulse'
            : ''
            } ${isOutgoing
              ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-indigo-950/20'
              : 'bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700/50 shadow-xs dark:shadow-slate-950/40'
            } ${imageAttachments.length > 0
              ? 'p-1.5'
              : audioAttachments.length > 0
                ? (replySnapshot ? 'p-1.5' : 'px-3 py-2')
                : replySnapshot
                  ? 'px-1.5 py-2.5'
                  : 'px-4 py-2.5'}`}
        >
          {/* Quoted Message Snapshot Card (Phase 11) */}
          {replySnapshot && (
            <div
              onClick={() => replyTo && onJumpToMessage(replyTo)}
              className={`mb-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-all flex items-center justify-between gap-2.5 border-l-[3.5px] ${isOutgoing
                ? 'bg-black/15 hover:bg-black/25 border-white/90 text-white'
                : 'bg-slate-100 dark:bg-slate-900/70 hover:bg-slate-200/80 dark:hover:bg-slate-900 border-indigo-500 dark:border-indigo-400 text-slate-800 dark:text-slate-200'
                }`}
            >
              <div className="flex-1 min-w-0">
                <p
                  className={`font-bold text-[11px] truncate ${isOutgoing ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                >
                  {replySnapshot.senderId === currentUserId || replySnapshot.senderName === 'You'
                    ? 'You'
                    : replySnapshot.senderName || 'User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 truncate text-[11px] opacity-90">
                  {replySnapshot.messageType === 'image' && (
                    <>
                      <ImageIcon size={12} className="shrink-0" />
                      <span>Photo</span>
                    </>
                  )}
                  {replySnapshot.messageType === 'audio' && (
                    <>
                      <Mic size={12} className="shrink-0" />
                      <span>Voice message</span>
                    </>
                  )}
                  {replySnapshot.messageType === 'document' && (
                    <>
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate">{replySnapshot.fileName || 'Document'}</span>
                    </>
                  )}
                  {(replySnapshot.messageType === 'text' || !replySnapshot.messageType || replySnapshot.message) && (
                    <span className="truncate">{replySnapshot.message || 'Media'}</span>
                  )}
                </div>
              </div>
              {replySnapshot.fileUrl && replySnapshot.messageType === 'image' && (
                <img
                  src={replySnapshot.fileUrl}
                  alt="thumb"
                  className="w-8 h-8 rounded-lg object-cover shrink-0 border border-black/10"
                />
              )}
            </div>
          )}
          {/* 1. IMAGE COLLAGE / GRID RENDERING */}
          {imageAttachments.length > 0 && (
            <div className="relative rounded-xl overflow-hidden mb-1">
              <div
                className={`gap-1 grid ${imageAttachments.length === 1
                  ? 'grid-cols-1'
                  : imageAttachments.length === 2
                    ? 'grid-cols-2'
                    : imageAttachments.length === 3
                      ? 'grid-cols-2'
                      : 'grid-cols-2'
                  }`}
              >
                {imageAttachments.slice(0, 4).map((att, idx) => {
                  const isSpanAcross = imageAttachments.length === 3 && idx === 0;
                  const isExtraBadge = imageAttachments.length > 4 && idx === 3;
                  const extraCount = imageAttachments.length - 4;

                  return (
                    <div
                      key={att.fileUrl || idx}
                      onClick={() => status !== 'sending' && onImageClick(imageAttachments, idx)}
                      className={`relative group bg-slate-900/10 ${status !== 'sending' ? 'cursor-pointer' : ''} overflow-hidden rounded-lg ${isSpanAcross ? 'col-span-2 max-h-[220px]' : 'aspect-square max-h-[160px]'
                        }`}
                    >
                      <img
                        src={att.fileUrl}
                        alt={att.fileName || 'attachment'}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />

                      {isExtraBadge && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg backdrop-blur-xs">
                          +{extraCount + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* In-Grid Circular Progress Ring with Cancel (X) Button (WhatsApp Style) */}
              {status === 'sending' && (
                <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex flex-col items-center justify-center z-20 transition-all animate-in fade-in duration-150">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    {/* SVG Circular Progress Track & Ring */}
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                      {/* Background Track Circle */}
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        className="stroke-white/20"
                        strokeWidth="3.5"
                        fill="transparent"
                      />
                      {/* Animated Fill Circle */}
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        className="stroke-white transition-all duration-150 ease-out"
                        strokeWidth="3.5"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={2 * Math.PI * 20 * (1 - (uploadProgress || 0) / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>

                    {/* Centered Cancel (X) Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelUpload();
                      }}
                      className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-black/60 hover:bg-red-500/90 text-white flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95"
                      title="Cancel upload"
                    >
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Live Percentage Text */}
                  <span className="text-[11px] font-bold text-white mt-1.5 drop-shadow-sm select-none">
                    {uploadProgress || 0}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 2. AUDIO / VOICE NOTE PLAYER */}
          {audioAttachments.length > 0 && (
            <div className="space-y-1.5 mb-1">
              {audioAttachments.map((audio, idx) => (
                <VoiceNotePlayer
                  key={audio.fileUrl || idx}
                  fileUrl={audio.fileUrl}
                  fileName={audio.fileName}
                  duration={audio.duration || 0}
                  waveform={audio.waveform || []}
                  isOutgoing={isOutgoing}
                />
              ))}
            </div>
          )}

          {/* 3. DOCUMENT ATTACHMENTS LIST */}
          {docAttachments.length > 0 && (
            <div className="space-y-1.5 mb-1.5">
              {docAttachments.map((doc, idx) => (
                <div
                  key={doc.fileUrl || idx}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${isOutgoing
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isOutgoing ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                      }`}
                  >
                    <FileText size={18} />
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-xs font-semibold truncate">{doc.fileName || 'Document'}</p>
                    {doc.fileSize && (
                      <p
                        className={`text-[10px] mt-0.5 ${isOutgoing ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-400'
                          }`}
                      >
                        {formatFileSize(doc.fileSize)}
                      </p>
                    )}
                  </div>

                  <a
                    href={doc.fileUrl}
                    download={doc.fileName || 'document'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-lg transition-colors shrink-0 ${isOutgoing
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                      }`}
                    title="Download file"
                  >
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Text Message / Optional Caption */}
          {message && (
            <p
              className={`leading-relaxed whitespace-pre-wrap ${replySnapshot || imageAttachments.length > 0
                ? 'px-2 pt-0.5 pb-0.5'
                : ''
                }`}
            >
              {message}
            </p>
          )}

          {/* Timestamp & Status Checkmarks */}
          <div
            className={`flex items-center justify-end gap-1 text-[10px] select-none ${replySnapshot || imageAttachments.length > 0
              ? 'px-1.5 pt-0.5 pb-0.5'
              : 'mt-1'
              } ${isOutgoing ? 'text-indigo-200/80' : 'text-slate-400 dark:text-slate-400'}`}
          >
            <span>{formatTime(createdAt)}</span>

            {isOutgoing && (
              <span>
                {status === 'sending' ? (
                  <Clock size={12} className="animate-pulse opacity-75" />
                ) : status === 'failed' ? (
                  <AlertCircle size={12} className="text-red-400" />
                ) : status === 'read' ? (
                  <CheckCheck size={13} className="text-sky-300" />
                ) : status === 'delivered' ? (
                  <CheckCheck size={13} />
                ) : (
                  <Check size={13} />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Attached Reaction Pill Badges */}
        {hasReactions && (
          <div
            className={`absolute -bottom-2.5 ${isOutgoing ? 'right-2' : 'left-2'
              } z-20 flex flex-wrap gap-1 select-none pointer-events-auto`}
          >
            {Object.entries(reactionGroups).map(([emoji, group]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(messageId, emoji)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all cursor-pointer shadow-xs active:scale-95 ${group.hasUserReacted
                  ? 'bg-indigo-50 dark:bg-indigo-950/90 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 font-bold ring-1 ring-indigo-400/40'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium hover:border-slate-300'
                  }`}
                title={group.hasUserReacted ? 'Click to remove reaction' : 'Click to react'}
              >
                <span className="text-xs leading-none">{emoji}</span>
                {group.count > 1 && (
                  <span className="text-[11px] font-semibold leading-none">{group.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
