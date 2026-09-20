/**
 * Read a local image File and return a data URL, downscaled so it
 * fits comfortably in localStorage (max ~900px on the longest side).
 */
export function readImageFile(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type.startsWith('image/')) return reject(new Error('Not an image'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function readVideoFile(file, maxSizeMb = 4, minDurationSec = 10) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type.startsWith('video/')) return reject(new Error('Not a video'));

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return reject(new Error(`Video must be smaller than ${maxSizeMb}MB for browser storage.`));
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      if (!Number.isFinite(duration) || duration < minDurationSec) {
        return reject(new Error(`Video must be at least ${minDurationSec} seconds long.`));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read video file'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    };
    video.onerror = () => reject(new Error('Could not read video metadata'));

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
  });
}
