import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ImageCropper from '../common/ImageCropper';

const STATUS_DOT_CLASSES = {
  available: 'bg-emerald-500',
  away: 'bg-amber-400',
  busy: 'bg-rose-500',
  offline: 'bg-slate-400 dark:bg-slate-500',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_AVATAR_RAW_MB = 15;

/**
 * Pure presentational UI modal / mobile bottom-sheet for editing user profile.
 * Cropping is delegated to <ImageCropper />, and upload/API mutations live in HomePage.jsx & utils/fileUpload.js.
 */
const ProfileEditModal = ({
  isOpen = false,
  onClose = () => { },
  currentUser = null,
  isSaving = false,
  onSaveProfile = () => { },
  onViewAvatar = () => { },
  statusOptions = [],
  maxBioLength = 120,
}) => {
  const [fullname, setFullname] = useState('');
  const [bio, setBio] = useState('');
  const [customStatus, setCustomStatus] = useState('available');
  const [selectedFile, setSelectedFile] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const fileInputRef = useRef(null);
  const objectUrlRef = useRef(null);

  const revokePreviewUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // Sync form state whenever modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      setFullname(currentUser.fullname || '');
      setBio(currentUser.bio ?? 'Hey there! I am using Txtro.');
      setCustomStatus(currentUser.customStatus || 'available');
      setSelectedFile(null);
      setCropFile(null);
      setRemoveAvatar(false);
      setPreviewUrl(currentUser.avatar || '');
    }
    return () => {
      revokePreviewUrl();
    };
  }, [isOpen, currentUser]);

  // Close on Escape key (only when cropper & lightbox are not open)
  useEffect(() => {
    if (!isOpen || cropFile) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving && !document.querySelector('.yarl__root')) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, cropFile, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      toast.error('Please select a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_AVATAR_RAW_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${MAX_AVATAR_RAW_MB} MB.`);
      return;
    }

    setCropFile(file);
  };

  const handleCropApply = (croppedFile) => {
    setCropFile(null);
    revokePreviewUrl();
    const localUrl = URL.createObjectURL(croppedFile);
    objectUrlRef.current = localUrl;
    setSelectedFile(croppedFile);
    setPreviewUrl(localUrl);
    setRemoveAvatar(false);
  };

  const handleRemovePhoto = () => {
    revokePreviewUrl();
    setSelectedFile(null);
    setPreviewUrl('');
    setRemoveAvatar(Boolean(currentUser?.avatar));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedName = fullname.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      toast.error('Display name must be between 3 and 100 characters.');
      return;
    }

    onSaveProfile({
      fullname: trimmedName,
      bio: bio.slice(0, maxBioLength).trim(),
      customStatus,
      selectedFile,
      removeAvatar,
    });
  };

  const initials = (fullname || currentUser?.fullname || currentUser?.username || 'ME')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fadeIn p-0 md:p-4"
        onClick={() => !isSaving && onClose()}
      >
        <div
          className="w-full md:max-w-md bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Drag Handle */}
          <div className="md:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Profile</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">@{currentUser?.username}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            {/* Avatar Studio */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Avatar preview"
                    onClick={() =>
                      onViewAvatar({
                        fullname: fullname || currentUser?.fullname,
                        username: currentUser?.username,
                        avatar: previewUrl,
                      })
                    }
                    title="View full screen"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/10 cursor-zoom-in transition-transform hover:scale-105"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-indigo-500/20 select-none">
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  title="Change profile photo"
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center justify-center border-2 border-white dark:border-slate-900 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Camera size={16} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {previewUrl ? 'Change Photo' : 'Upload Photo'}
                </button>

                {previewUrl && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Remove Photo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                maxLength={100}
                disabled={isSaving}
                placeholder="Your display name"
                className="w-full h-10 px-3.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {/* Bio / About */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bio / About
                </label>
                <span className={`text-[11px] font-medium ${bio.length >= maxBioLength - 10 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {bio.length}/{maxBioLength}
                </span>
              </div>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, maxBioLength))}
                maxLength={maxBioLength}
                disabled={isSaving}
                placeholder="Hey there! I am using Txtro."
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              />
            </div>

            {/* Custom Status (Populated from Backend) */}
            {statusOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Current Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((opt) => {
                    const isActive = customStatus === opt.value;
                    const dotClass = STATUS_DOT_CLASSES[opt.value] || STATUS_DOT_CLASSES.available;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isSaving}
                        onClick={() => setCustomStatus(opt.value)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer
                          ${isActive
                            ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                          <span className="truncate">{opt.label}</span>
                        </span>
                        {isActive && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Decoupled Reusable 1:1 Image Cropper */}
      <ImageCropper
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onCropApply={handleCropApply}
      />
    </>
  );
};

export default ProfileEditModal;
