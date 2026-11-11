const PRODUCT_ID_PATTERN = /^PD-(\d+)$/i;

export function normalizeProductId(id) {
  const value = String(id ?? '').trim();
  return PRODUCT_ID_PATTERN.test(value) ? value.toUpperCase() : value;
}

export function createNextProductId(products = []) {
  const usedIds = new Set(products.map((product) => normalizeProductId(product?.id)));
  const highestSequence = products.reduce((highest, product) => {
    const match = normalizeProductId(product?.id).match(PRODUCT_ID_PATTERN);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  let sequence = highestSequence + 1;
  let id = `PD-${String(sequence).padStart(3, '0')}`;
  while (usedIds.has(id)) {
    sequence += 1;
    id = `PD-${String(sequence).padStart(3, '0')}`;
  }
  return id;
}

export function createProductImportId(products = [], pendingId) {
  const pendingProduct = pendingId == null || pendingId === '' ? null : products.find((product) =>
    normalizeProductId(product?.id) === normalizeProductId(pendingId)
  );
  if (pendingProduct) return pendingProduct.id;

  if (pendingId && PRODUCT_ID_PATTERN.test(String(pendingId))) {
    const normalizedPendingId = normalizeProductId(pendingId);
    const pendingIdIsAvailable = products.every((product) =>
      normalizeProductId(product?.id) !== normalizedPendingId
    );
    if (pendingIdIsAvailable) return normalizedPendingId;
  }

  return createNextProductId(products);
}
