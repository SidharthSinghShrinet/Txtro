import React from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import UserAvatar from './UserAvatar';

/**
 * Reusable full-screen WhatsApp-style profile picture Lightbox.
 * Always renders the high-resolution `avatar` (falling back to `avatarThumb` if needed).
 */
const AvatarLightbox = ({
  user = null,
  onClose = () => { },
}) => {
  const avatarSrc = user?.avatar || user?.avatarThumb || '';

  return (
    <Lightbox
      open={Boolean(avatarSrc)}
      close={onClose}
      slides={avatarSrc ? [{ src: avatarSrc, alt: user?.fullname || 'Profile picture' }] : []}
      plugins={[Zoom]}
      animation={{ fade: 200 }}
      carousel={{ finite: true }}
      controller={{ closeOnBackdropClick: true }}
      render={{
        buttonPrev: () => null,
        buttonNext: () => null,
        buttonZoom: () => null,
      }}
      toolbar={{
        buttons: [
          <div key="avatar-header" className="mr-auto flex items-center gap-3 pl-1 sm:pl-3 select-none">
            <UserAvatar
              user={user}
              sizeClass="w-8 h-8 text-[11px]"
              roundedClass="rounded-full"
            />
            <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
              {user?.fullname || user?.username || 'Profile Picture'}
            </span>
          </div>,
          'close',
        ],
      }}
      styles={{
        container: { backgroundColor: 'rgba(10, 10, 12, 0.94)' },
        toolbar: { width: '100%', padding: '12px 16px' },
      }}
    />
  );
};

export default AvatarLightbox;
