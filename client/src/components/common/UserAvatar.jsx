import React, { useEffect, useState } from 'react';

const STATUS_DOT_STYLES = {
  available: 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
  away: 'bg-amber-400 shadow-sm shadow-amber-400/50',
  busy: 'bg-rose-500 shadow-sm shadow-rose-500/50',
  offline: 'bg-slate-400 dark:bg-slate-600',
};

const STATUS_LABELS = {
  available: 'Online • Available',
  away: 'Online • Away',
  busy: 'Online • Busy',
  offline: 'Online • Do Not Disturb',
};

/**
 * Reusable user avatar component with graceful image error fallback to initials
 * and optional online/custom-status indicator dot.
 */
const UserAvatar = ({
  user = null,
  sizeClass = 'w-10 h-10 text-xs',
  roundedClass = 'rounded-xl',
  gradientClass = 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20',
  showStatus = false,
  isOnline = false,
  useThumb = true,
  dotSizeClass = 'w-3 h-3',
  dotBorderClass = 'border-2 border-white dark:border-slate-950',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const avatarSrc = useThumb ? (user?.avatarThumb || user?.avatar) : user?.avatar;

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  const initials =
    user?.fullname?.trim()?.slice(0, 2) ||
    user?.username?.trim()?.slice(0, 2) ||
    'US';

  const hasValidAvatar = Boolean(avatarSrc) && !imgError;

  const statusKey = isOnline ? (user?.customStatus || 'available') : 'offline';
  const dotColor = isOnline
    ? (STATUS_DOT_STYLES[statusKey] || STATUS_DOT_STYLES.available)
    : STATUS_DOT_STYLES.offline;
  const dotTitle = isOnline
    ? (STATUS_LABELS[statusKey] || 'Online')
    : 'Offline';

  return (
    <div className={`relative shrink-0 ${className}`}>
      {hasValidAvatar ? (
        <img
          src={avatarSrc}
          alt={user?.fullname || user?.username || 'User avatar'}
          onError={() => setImgError(true)}
          className={`${sizeClass} ${roundedClass} object-cover bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-sm select-none`}
        />
      ) : (
        <div
          className={`${sizeClass} ${roundedClass} ${gradientClass} flex items-center justify-center font-bold uppercase select-none`}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${dotSizeClass} ${dotBorderClass} rounded-full transition-colors ${dotColor}`}
          title={dotTitle}
        />
      )}
    </div>
  );
};

export default UserAvatar;
