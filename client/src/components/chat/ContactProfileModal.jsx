import React, { useEffect } from 'react';
import { X, Info } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { formatLastSeen } from '../../utils/date';

const STATUS_STYLE_CLASSES = {
  available: { dotClass: 'bg-emerald-500', textClass: 'text-emerald-600 dark:text-emerald-400' },
  away: { dotClass: 'bg-amber-400', textClass: 'text-amber-600 dark:text-amber-400' },
  busy: { dotClass: 'bg-rose-500', textClass: 'text-rose-600 dark:text-rose-400' },
  offline: { dotClass: 'bg-slate-400', textClass: 'text-slate-500 dark:text-slate-400' },
};

const ContactProfileModal = ({
  isOpen = false,
  onClose = () => { },
  contact = null,
  isOnline = false,
  statusOptions = [],
  onViewAvatar = () => { },
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.yarl__root')) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !contact) return null;

  const statusKey = contact.customStatus || 'available';
  const matchedOption = statusOptions.find((opt) => opt.value === statusKey);
  const statusLabel = matchedOption?.label || statusKey;
  const statusStyles = STATUS_STYLE_CLASSES[statusKey] || STATUS_STYLE_CLASSES.available;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800 dark:text-white">Contact Info</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div
            onClick={() => (contact.avatar || contact.avatarThumb) && onViewAvatar(contact)}
            title={contact.avatar || contact.avatarThumb ? 'View profile photo' : undefined}
            className={contact.avatar || contact.avatarThumb ? 'cursor-zoom-in transition-transform hover:scale-105' : ''}
          >
            <UserAvatar
              user={contact}
              sizeClass="w-24 h-24 text-2xl"
              roundedClass="rounded-2xl"
              useThumb={false}
              showStatus
              isOnline={isOnline}
              dotSizeClass="w-4 h-4"
              dotBorderClass="border-2 border-white dark:border-slate-900"
            />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{contact.fullname}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">@{contact.username}</p>
          </div>

          {/* Presence + Custom Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${isOnline ? statusStyles.dotClass : 'bg-slate-400'}`} />
            {isOnline ? (
              <span className={`${statusStyles.textClass} capitalize`}>{statusLabel}</span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">{formatLastSeen(contact.lastSeen)}</span>
            )}
          </div>

          {/* Bio Card */}
          <div className="w-full text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              <Info size={12} />
              About
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 break-words leading-relaxed">
              {contact.bio?.trim() || 'Hey there! I am using Txtro.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactProfileModal;
