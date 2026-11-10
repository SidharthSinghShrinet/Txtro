import React from 'react';
import { Check, CheckCheck, FileText, Download, Clock, AlertCircle, X } from 'lucide-react';
import VoiceNotePlayer from './VoiceNotePlayer';

const MessageBubble = ({
  message = '',
  createdAt = new Date(),
  isOutgoing = false,
  status = 'sent',
  messageType = 'text',
  attachments = [],
  uploadProgress = 0,
  onCancelUpload = () => { },
  onImageClick = () => { },
}) => {
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

  return (
    <div
      className={`flex w-full mb-3 ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[88%] sm:max-w-[72%] rounded-2xl shadow-sm text-sm break-words relative transition-all overflow-hidden ${
          isOutgoing
            ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-indigo-950/20'
            : 'bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700/50 shadow-xs dark:shadow-slate-950/40'
        } ${imageAttachments.length > 0 ? 'p-1.5' : audioAttachments.length > 0 ? 'px-3 py-2' : 'px-4 py-2.5'}`}
      >
        {/* 1. IMAGE COLLAGE / GRID RENDERING */}
        {imageAttachments.length > 0 && (
          <div className="relative rounded-xl overflow-hidden mb-1">
            <div
              className={`gap-1 grid ${
                imageAttachments.length === 1
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
                    className={`relative group bg-slate-900/10 ${status !== 'sending' ? 'cursor-pointer' : ''} overflow-hidden rounded-lg ${
                      isSpanAcross ? 'col-span-2 max-h-[220px]' : 'aspect-square max-h-[160px]'
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
                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  isOutgoing
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isOutgoing ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  <FileText size={18} />
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-xs font-semibold truncate">{doc.fileName || 'Document'}</p>
                  {doc.fileSize && (
                    <p
                      className={`text-[10px] mt-0.5 ${
                        isOutgoing ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-400'
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
                  className={`p-2 rounded-lg transition-colors shrink-0 ${
                    isOutgoing
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
            className={`leading-relaxed whitespace-pre-wrap ${
              imageAttachments.length > 0 ? 'px-2 pt-1 pb-0.5' : ''
            }`}
          >
            {message}
          </p>
        )}

        {/* Timestamp & Status Checkmarks */}
        <div
          className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
            imageAttachments.length > 0 ? 'px-2 pb-0.5' : ''
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
    </div>
  );
};

export default MessageBubble;
