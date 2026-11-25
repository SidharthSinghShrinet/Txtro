import React from 'react';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react';
import { formatLastSeen } from '../../utils/date';
import UserAvatar from '../common/UserAvatar';

const STATUS_TEXT_CLASSES = {
  available: 'text-emerald-500 dark:text-emerald-400',
  away: 'text-amber-500 dark:text-amber-400',
  busy: 'text-rose-500 dark:text-rose-400',
  offline: 'text-slate-500 dark:text-slate-400',
};

const ChatHeader = ({
  selectedUser = null,
  isOnline = false,
  isTyping = false,
  onBack = () => { },
  onOpenContactProfile = () => { },
  statusOptions = [],
}) => {
  if (!selectedUser) return null;

  const statusKey = selectedUser?.customStatus || 'available';
  const matchedOption = statusOptions.find((opt) => opt.value === statusKey);
  const onlineLabel =
    statusKey === 'available'
      ? 'Online'
      : `Online • ${matchedOption?.label || statusKey}`;
  const statusTextClass = STATUS_TEXT_CLASSES[statusKey] || STATUS_TEXT_CLASSES.available;

  return (
    <div className="h-16 px-3 sm:px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0 transition-colors duration-200 gap-2 w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {/* Back button for mobile */}
        <button
          onClick={onBack}
          type="button"
          className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <ArrowLeft size={19} />
        </button>

        {/* Clickable Contact Info Area */}
        <button
          type="button"
          onClick={onOpenContactProfile}
          title="View contact info"
          className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 text-left cursor-pointer group rounded-xl py-1 pr-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
        >
          <UserAvatar
            user={selectedUser}
            sizeClass="w-9 h-9 sm:w-10 sm:h-10 text-xs"
            showStatus
            isOnline={isOnline}
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {selectedUser?.fullname}
            </h2>
            {isTyping ? (
              <p className="text-xs text-emerald-500 dark:text-emerald-400 font-medium tracking-wide animate-pulse mt-0.5 truncate">
                Typing...
              </p>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {isOnline ? (
                  <p className={`text-xs font-medium truncate ${!matchedOption?.label && statusKey !== 'available' ? 'capitalize ' : ''}${statusTextClass}`}>
                    {onlineLabel}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {formatLastSeen(selectedUser?.lastSeen)}
                  </p>
                )}
              </div>
            )}
          </div>
        </button>
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
