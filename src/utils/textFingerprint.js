export const fingerprintText = async (text) => {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let first = 2166136261;
  let second = 2246822519;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 16777619);
    second = Math.imul(second ^ byte, 3266489917);
  }
  return `${bytes.length}-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
};
