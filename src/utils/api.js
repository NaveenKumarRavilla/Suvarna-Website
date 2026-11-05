const API_PATH = '/api/index.php';

export async function apiRequest(action, { method = 'GET', body, query } = {}) {
  const url = new URL(API_PATH, window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(query || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the Hostinger API. Check the deployment and internet connection.');
  }

  const contentType = response.headers.get('content-type') || 'unknown content type';
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `The Hostinger API returned a non-JSON response (HTTP ${response.status}, ${contentType}). Check the deployed PHP file and Hostinger PHP error log.`,
    );
  }
  if (!response.ok) {
    const error = new Error(result.error || `The API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}
