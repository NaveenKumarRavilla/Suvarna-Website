export const createClientRecordId = (prefix) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure record ID generation is unavailable in this browser.');
  const suffix = cryptoApi.randomUUID
    ? cryptoApi.randomUUID()
    : [...cryptoApi.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  return `${prefix}-${suffix}`;
};
