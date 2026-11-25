import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ArrowLeft, Check, X, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCroppedImageFile } from '../../utils/cropImage';

/**
 * Reusable 1:1 circular image cropper modal / bottom-sheet.
 * Completely decoupled from ProfileEditModal so any component can reuse it.
 */
const ImageCropper = ({
  file = null,
  onCancel = () => { },
  onCropApply = () => { },
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const objectUrlRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setImageUrl('');
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isApplying) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, isApplying, onCancel]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  if (!file || !imageUrl) return null;

  const handleApply = async () => {
    if (!croppedAreaPixels || isApplying) return;
    setIsApplying(true);
    try {
      const croppedFile = await getCroppedImageFile(imageUrl, croppedAreaPixels, file.name);
      onCropApply(croppedFile);
    } catch {
      toast.error('Failed to crop image. Please try another photo.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 md:p-4"
      onClick={() => !isApplying && onCancel()}
    >
      <div
        className="w-full md:max-w-md bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="p-1.5 -ml-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Adjust Photo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Drag and zoom to frame your avatar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Crop Canvas */}
        <div className="p-6 space-y-5">
          <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 px-1">
            <ZoomIn size={16} className="text-slate-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-10 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
            >
              <Check size={14} />
              {isApplying ? 'Applying...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
