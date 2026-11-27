import React from 'react';
import { ArrowLeft, Star, Loader2, FileText, Mic, Link2, Image as ImageIcon, Bookmark } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';

const VAULT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'text', label: 'Text' },
  { id: 'media', label: 'Media' },
  { id: 'docs', label: 'Docs' },
  { id: 'links', label: 'Links' },
];

const StarredMessagesVault = ({
  activeCategory = 'all',
  onCategoryChange = () => { },
  starredMessages = [],
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
  onLoadMore = () => { },
  currentUserId = null,
  usersMap = {},
  formatTime = () => '',
  onSelectStarredMessage = () => { },
  onUnstarMessage = () => { },
  onClose = () => { },
}) => {
  const renderStarredPreview = (msg) => {
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    const firstImage = attachments.find((a) => a.mimeType?.startsWith('image/'));
    const firstAudio = attachments.find((a) => a.mimeType?.startsWith('audio/'));
    const firstDoc = attachments.find((a) => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('audio/'));

    return (
      <div className="space-y-1.5 mt-1">
        {firstImage && (
          <div className="flex items-center gap-2">
            <img
              src={firstImage.fileUrl}
              alt={firstImage.fileName || 'Starred photo'}
              loading="lazy"
              className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700/70 shrink-0"
            />
            <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
              <ImageIcon size={12} />
              {attachments.filter((a) => a.mimeType?.startsWith('image/')).length > 1
                ? `${attachments.filter((a) => a.mimeType?.startsWith('image/')).length} Photos`
                : 'Photo'}
            </span>
          </div>
        )}

        {firstAudio && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
            <Mic size={12} className="shrink-0" />
            <span>Voice note</span>
          </div>
        )}

        {firstDoc && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-medium max-w-full">
            <FileText size={12} className="shrink-0 text-indigo-500" />
            <span className="truncate">{firstDoc.fileName || 'Document'}</span>
          </div>
        )}

        {msg.linkPreview?.url && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium max-w-full">
            <Link2 size={12} className="shrink-0" />
            <span className="truncate">{msg.linkPreview.title || msg.linkPreview.url}</span>
          </div>
        )}

        {msg.message && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 break-words leading-relaxed">
            {msg.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Vault Header */}
      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            title="Back to chats"
            className="p-1.5 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Star size={15} className="fill-amber-400 text-amber-500 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
              Starred Vault
            </h3>
          </div>
        </div>
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
          {starredMessages.length} saved
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-800/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {VAULT_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCategoryChange(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${isActive
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Starred List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {isLoading && starredMessages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
            <span className="text-xs">Loading starred messages...</span>
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2.5 text-slate-400 dark:text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 flex items-center justify-center">
              <Bookmark size={20} className="text-amber-500" />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No starred {activeCategory === 'all' ? 'messages' : activeCategory} yet
            </p>
            <p className="text-[11px] leading-relaxed max-w-[210px]">
              Tap the star icon on any message to save it privately in your Vault.
            </p>
          </div>
        ) : (
          <>
            {starredMessages.map((msg) => {
              const isOutgoing = msg.senderId?.toString() === currentUserId?.toString();
              const contactId = isOutgoing ? msg.receiverId : msg.senderId;
              const contact = usersMap[contactId];
              if (!contact) return null;

              return (
                <div
                  key={msg._id}
                  onClick={() => onSelectStarredMessage(msg, contact)}
                  className="group p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        user={contact}
                        sizeClass="w-7 h-7 text-[10px]"
                        gradientClass="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {isOutgoing ? `You → ${contact.fullname}` : contact.fullname}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatTime(msg.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnstarMessage(msg._id);
                        }}
                        title="Remove from starred"
                        className="p-1 rounded-lg text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        <Star size={13} className="fill-amber-400 text-amber-500" />
                      </button>
                    </div>
                  </div>

                  {renderStarredPreview(msg)}
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2 pb-1 flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200/70 dark:border-indigo-500/20 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isLoadingMore && <Loader2 size={13} className="animate-spin" />}
                  {isLoadingMore ? 'Loading...' : 'Load older starred'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StarredMessagesVault;
