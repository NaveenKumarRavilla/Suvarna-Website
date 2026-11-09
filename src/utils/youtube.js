const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);

export function extractYouTubeVideoId(value = '') {
  const input = String(value).trim();
  if (VIDEO_ID_PATTERN.test(input)) return input;
  let url;
  try {
    url = new URL(input);
  } catch {
    return '';
  }
  if (!['https:', 'http:'].includes(url.protocol) || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return '';

  let id = '';
  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    id = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v') || '';
  } else if (url.pathname.startsWith('/embed/')) {
    id = url.pathname.split('/')[2] || '';
  }
  return VIDEO_ID_PATTERN.test(id) ? id : '';
}
