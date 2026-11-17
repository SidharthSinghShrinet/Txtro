import React from 'react';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react';
import { formatLastSeen } from '../../utils/date';

const ChatHeader = ({
  selectedUser = null,
  isOnline = false,
  isTyping = false,
  onBack = () => { },
}) => {
  if (!selectedUser) return null;

  return (
    <div className="h-16 px-3 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0 transition-colors duration-200 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Back button for mobile */}
        <button
          onClick={onBack}
          type="button"
          className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <ArrowLeft size={19} />
        </button>

        {/* Contact Avatar */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-xs uppercase shadow-md shadow-indigo-500/20">
            {selectedUser?.fullname?.slice(0, 2) || selectedUser?.username?.slice(0, 2) || 'US'}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400 dark:bg-slate-600'
              }`}
          />
        </div>

        {/* Contact Details */}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">
            {selectedUser?.fullname}
          </h2>
          {isTyping ? (
            <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium tracking-wide animate-pulse mt-0.5 truncate">
              Typing...
            </p>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              {isOnline ? (
                <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium truncate">
                  Online
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {formatLastSeen(selectedUser?.lastSeen)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons (Pure UI Icons) */}
      <div className="flex items-center gap-0.5 sm:gap-1 text-slate-400 dark:text-slate-400 shrink-0">
        <button
          type="button"
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Voice call"
        >
          <Phone size={17} className="sm:w-[18px] sm:h-[18px]" />
        </button>
        <button
          type="button"
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Video call"
        >
          <Video size={17} className="sm:w-[18px] sm:h-[18px]" />
        </button>
        <button
          type="button"
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="More options"
        >
          <MoreVertical size={17} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
