import React from 'react';

const SKELETON_ROWS = [
  { isOutgoing: false, widthClass: 'w-48 sm:w-64', lines: 1 },
  { isOutgoing: true, widthClass: 'w-40 sm:w-56', lines: 1 },
  { isOutgoing: false, widthClass: 'w-56 sm:w-72', lines: 2 },
  { isOutgoing: true, widthClass: 'w-44 sm:w-60', lines: 1 },
  { isOutgoing: true, widthClass: 'w-32 sm:w-44', lines: 1 },
  { isOutgoing: false, widthClass: 'w-52 sm:w-64', lines: 2 },
];

/**
 * Pure presentational shimmer skeleton mimicking chat bubbles while messages load.
 */
const MessageSkeleton = () => {
  return (
    <div className="h-full flex flex-col justify-end space-y-3 py-2 select-none" aria-label="Loading conversation">
      {/* Date Pill Placeholder */}
      <div className="flex justify-center pb-2">
        <div className="h-5 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800/80 animate-pulse" />
      </div>

      {SKELETON_ROWS.map((row, idx) => (
        <div
          key={idx}
          className={`flex ${row.isOutgoing ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`${row.widthClass} rounded-2xl px-4 py-3 animate-pulse ${row.isOutgoing
              ? 'bg-indigo-500/20 dark:bg-indigo-600/25 rounded-br-xs'
              : 'bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/50 rounded-bl-xs'
              }`}
          >
            <div className="space-y-2">
              <div
                className={`h-3 rounded-full ${row.isOutgoing
                  ? 'bg-indigo-400/30 dark:bg-indigo-400/25 w-full'
                  : 'bg-slate-200 dark:bg-slate-700 w-full'
                  }`}
              />
              {row.lines > 1 && (
                <div
                  className={`h-3 rounded-full ${row.isOutgoing
                    ? 'bg-indigo-400/25 dark:bg-indigo-400/20 w-2/3'
                    : 'bg-slate-200/80 dark:bg-slate-700/80 w-3/4'
                    }`}
                />
              )}
            </div>
            <div className="mt-2 flex justify-end">
              <div
                className={`h-2 w-10 rounded-full ${row.isOutgoing
                  ? 'bg-indigo-400/25 dark:bg-indigo-400/20'
                  : 'bg-slate-200/70 dark:bg-slate-700/70'
                  }`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageSkeleton;
