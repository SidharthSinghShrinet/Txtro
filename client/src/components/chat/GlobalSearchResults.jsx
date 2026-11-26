import React from 'react';
import { Loader2, MessageSquareText } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import HighlightText from '../common/HighlightText';
import { getSearchSnippet } from '../../utils/searchUtils';

/**
 * Pure presentational UI list for Global Message Search results in the Sidebar.
 */
const GlobalSearchResults = ({
  searchQuery = '',
  results = [],
  isSearching = false,
  currentUserId = null,
  usersMap = {},
  formatTime = () => '',
  onSelectResult = () => { },
}) => {
  const trimmed = searchQuery.trim();
  if (trimmed.length < 2) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/70">
      <div className="px-2 pb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <MessageSquareText size={13} className="text-indigo-500 dark:text-indigo-400" />
          Messages
        </span>
        {isSearching && (
          <Loader2 size={13} className="animate-spin text-indigo-500" />
        )}
      </div>

      {isSearching && results.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Searching messages...
        </div>
      ) : results.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          No messages found for &ldquo;{trimmed}&rdquo;
        </div>
      ) : (
        <div className="space-y-1">
          {results.map((msg) => {
            const contactId =
              msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
            const contact = usersMap[contactId];
            if (!contact) return null;

            const snippet = getSearchSnippet(msg, trimmed);
            const isOutgoing = msg.senderId === currentUserId;

            return (
              <button
                key={msg._id}
                type="button"
                onClick={() => onSelectResult(msg, contact)}
                className="w-full p-2.5 rounded-2xl flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
              >
                <UserAvatar
                  user={contact}
                  sizeClass="w-10 h-10 text-xs"
                  gradientClass="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {contact.fullname}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {isOutgoing && (
                      <span className="text-slate-400 dark:text-slate-500">You: </span>
                    )}
                    <HighlightText text={snippet} query={trimmed} />
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GlobalSearchResults;
