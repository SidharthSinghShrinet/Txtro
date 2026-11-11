import React, { useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import DateSeparator from './DateSeparator';
import { isSameDay } from '../../utils/date';
import { MessageSquareDashed, UploadCloud, ChevronDown } from 'lucide-react';

// yet-another-react-lightbox + plugins & styles
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Download from "yet-another-react-lightbox/plugins/download";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

const ChatContainer = ({
  selectedUser = null,
  currentUser = null,
  isOnline = false,
  isTyping = false,
  messages = [],
  messageText = '',
  onMessageChange = () => { },
  onSendMessage = () => { },
  onSendAudio = () => { },
  onToggleReaction = () => { },
  onBack = () => { },
  isSending = false,
  selectedFiles = [],
  onFilesSelect = () => { },
  onFileRemove = () => { },
  isUploading = false,
  uploadProgress = 0,
  onCancelUpload = () => { },
  replyingToMessage = null,
  onSelectReply = () => { },
  onCancelReply = () => { },
}) => {
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Floating Scroll-to-Bottom & Unread Badging State
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(messages.length);

  // Jump-to-message Highlight Pulse State (Phase 11)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const highlightTimerRef = useRef(null);

  const handleJumpToMessage = (targetMessageId) => {
    if (!targetMessageId) return;
    const el = document.getElementById(`msg-${targetMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetMessageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  // YARL Lightbox Carousel State
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxSlides, setLightboxSlides] = useState([]);

  const handleOpenLightbox = (albumImages, clickedIndex) => {
    const slides = albumImages.map((att) => ({
      src: att.fileUrl,
      download: att.fileName || 'image.webp',
      alt: att.fileName || 'chat photo',
    }));
    setLightboxSlides(slides);
    setLightboxIndex(clickedIndex);
  };

  const handleCloseLightbox = () => {
    setLightboxIndex(-1);
  };

  // Track scrolling: show floating down arrow when scrolled up > 150px
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isFar = distanceFromBottom > 150;

    setShowScrollBottom(isFar);
    isNearBottomRef.current = !isFar;

    if (!isFar) {
      setNewMessagesCount(0);
    }
  };

  // Smooth scroll to recent messages on demand
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setNewMessagesCount(0);
    setShowScrollBottom(false);
    isNearBottomRef.current = true;
  };

  // Auto-scroll when switching contacts
  useEffect(() => {
    setNewMessagesCount(0);
    setShowScrollBottom(false);
    isNearBottomRef.current = true;
    prevMessagesLengthRef.current = 0;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 40);
    return () => clearTimeout(timer);
  }, [selectedUser?._id]);

  // Intelligent auto-scroll for new messages & typing
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (messages.length > prevLength && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const isOutgoing = lastMsg.senderId === currentUser?._id;

      // Always scroll down if the user sent it, or if they were already at the bottom
      if (isOutgoing || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // User was reading old messages: do not disrupt their scroll position! Increment badge count
        setNewMessagesCount((prev) => prev + 1);
      }
    } else if (messages.length > 0 && prevLength === 0) {
      // First load of messages for this conversation
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, currentUser?._id]);

  useEffect(() => {
    if (isTyping && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isTyping]);

  // Drag and Drop State & Handlers
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    if (isSending || isUploading) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesSelect(droppedFiles);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 h-full flex flex-col bg-slate-100/60 dark:bg-slate-950 overflow-hidden transition-colors duration-200"
    >
      {/* Sleek Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-600/10 dark:bg-indigo-950/40 backdrop-blur-[2px] border-2 border-dashed border-indigo-500 dark:border-indigo-400 m-3 rounded-2xl pointer-events-none transition-all duration-200 animate-fade-in">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl border border-indigo-100 dark:border-indigo-950/60 max-w-xs text-center scale-100">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-inner animate-bounce">
              <UploadCloud size={32} strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Drop files here to send
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add photos or documents up to 10 files
            </p>
          </div>
        </div>
      )}
      {/* Chat Top Header */}
      <ChatHeader
        selectedUser={selectedUser}
        isOnline={isOnline}
        isTyping={isTyping}
        onBack={onBack}
      />

      {/* Messages Scrollable Area Wrapper */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 shadow-xs">
                <MessageSquareDashed size={24} className="text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No messages yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Say hello to {selectedUser?.fullname} to start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOutgoing = msg.senderId === currentUser?._id;
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

              return (
                <React.Fragment key={msg._id || index}>
                  {showDateSeparator && <DateSeparator date={msg.createdAt} />}
                  <MessageBubble
                    messageId={msg._id}
                    message={msg.message}
                    createdAt={msg.createdAt}
                    isOutgoing={isOutgoing}
                    status={msg.status || 'sent'}
                    messageType={msg.messageType || 'text'}
                    attachments={msg.attachments || []}
                    reactions={msg.reactions || []}
                    replyTo={msg.replyTo}
                    replySnapshot={msg.replySnapshot}
                    isHighlighted={highlightedMessageId === msg._id}
                    currentUserId={currentUser?._id}
                    onToggleReaction={onToggleReaction}
                    onSelectReply={() => onSelectReply(msg)}
                    onJumpToMessage={handleJumpToMessage}
                    uploadProgress={uploadProgress}
                    onCancelUpload={onCancelUpload}
                    onImageClick={handleOpenLightbox}
                  />
                </React.Fragment>
              );
            })
          )}

          {/* Live Typing Bubble in Chat (Three Bouncing Dots) */}
          {isTyping && (
            <div className="flex justify-start mb-3 animate-fade-in">
              <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs dark:shadow-slate-950/40 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll-to-Bottom Button */}
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
          className={`absolute right-4 sm:right-6 bottom-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 shadow-md shadow-slate-900/10 dark:shadow-slate-950/40 backdrop-blur-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/90 hover:scale-105 active:scale-95 transition-all duration-300 ease-out ${
            showScrollBottom
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-3 scale-90 pointer-events-none'
          }`}
        >
          <ChevronDown size={20} className="stroke-[2.2]" />
          {newMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-emerald-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-xs">
              {newMessagesCount > 99 ? '99+' : newMessagesCount}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Message Input Box */}
      <MessageInput
        value={messageText}
        onChange={onMessageChange}
        onSubmit={onSendMessage}
        onSendAudio={onSendAudio}
        disabled={isSending || isUploading}
        placeholder={`Message ${selectedUser?.fullname || 'user'}...`}
        selectedFiles={selectedFiles}
        onFilesSelect={onFilesSelect}
        onFileRemove={onFileRemove}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        replyingTo={replyingToMessage}
        onCancelReply={onCancelReply}
        currentUserId={currentUser?._id}
      />

      {/* Professional YARL Lightbox with Carousel, Zoom, Download & Thumbnails */}
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={handleCloseLightbox}
        slides={lightboxSlides}
        plugins={[Zoom, Download, Thumbnails]}
        animation={{ fade: 250, swipe: 250 }}
        carousel={{ finite: true }}
        thumbnails={{ position: 'bottom', width: 80, height: 60 }}
      />
    </div>
  );
};

export default ChatContainer;
