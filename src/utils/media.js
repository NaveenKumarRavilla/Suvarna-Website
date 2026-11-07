const API_PATH = '/api/index.php';
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

export async function uploadMediaFile(file) {
  if (!file) throw new Error('Choose a media file first.');
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
    throw new Error('Media files must be no larger than 4 MB.');
  }

  const formData = new FormData();
  formData.append('media', file);
  let response;
  try {
    const url = new URL(API_PATH, window.location.origin);
    url.searchParams.set('action', 'media-upload');
    response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
  } catch {
    throw new Error('Could not reach the media upload API. Check the deployment and internet connection.');
  }

  const contentType = response.headers.get('content-type') || 'unknown content type';
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`The media API returned a non-JSON response (HTTP ${response.status}, ${contentType}).`);
  }
  if (!response.ok) {
    throw new Error(result.error || `The media upload failed (${response.status}).`);
  }
  if (typeof result.url !== 'string' || !result.url.startsWith('/uploads/media/')) {
    throw new Error('The media API returned an invalid file URL.');
  }
  return result.url;
}

export function validateVideoDuration(file, minimumSeconds = 10) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('video/')) {
      reject(new Error('Only video files are allowed.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      URL.revokeObjectURL(objectUrl);
      if (!Number.isFinite(duration) || duration < minimumSeconds) {
        reject(new Error(`Video must be at least ${minimumSeconds} seconds long.`));
        return;
      }
      resolve();
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read video metadata.'));
    };
    video.src = objectUrl;
  });
}
