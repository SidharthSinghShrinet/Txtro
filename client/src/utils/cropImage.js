/**
 * Loads an image element from a URL/blob URL.
 */
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = src;
  });

/**
 * Extracts a 1:1 cropped File from an image source using an offscreen HTML5 canvas.
 * @param {string} imageSrc - Blob or image URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {string} fileName - Original file name
 * @returns {Promise<File>}
 */
export const getCroppedImageFile = async (imageSrc, pixelCrop, fileName = 'avatar.png') => {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to crop image'));
          return;
        }
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const croppedFile = new File([blob], `${baseName}.png`, { type: 'image/png' });
        resolve(croppedFile);
      },
      'image/png',
      1
    );
  });
};
