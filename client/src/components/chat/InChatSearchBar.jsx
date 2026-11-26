import React, { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

/**
 * Pure presentational UI bar for In-Chat Search (1 of N navigation).
 */
const InChatSearchBar = ({
  isOpen = false,
  searchQuery = '',
  matchedCount = 0,
  activeMatchPosition = 0,
  onSearchChange = () => { },
  onOlderMatch = () => { },
  onNewerMatch = () => { },
  onClose = () => { },
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onNewerMatch();
      } else {
        onOlderMatch();
      }
    }
  };

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="px-3 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center gap-2 shrink-0">
      <div className="relative flex-1 flex items-center min-w-0">
        <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in conversation..."
          className="w-full h-9 pl-9 pr-8 text-xs sm:text-sm text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 rounded-xl outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            title="Clear text"
            className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Match Counter */}
      {hasQuery && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0 px-1">
          {matchedCount > 0 ? `${activeMatchPosition} of ${matchedCount}` : '0 of 0'}
        </span>
      )}

      {/* Navigation Arrows */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onOlderMatch}
          disabled={matchedCount === 0}
          title="Previous (older) match"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronUp size={17} />
        </button>
        <button
          type="button"
          onClick={onNewerMatch}
          disabled={matchedCount === 0}
          title="Next (newer) match"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronDown size={17} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close search (Esc)"
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
};

export default InChatSearchBar;
