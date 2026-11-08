const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

// A legacy product ID may have been reused. Preserve the order snapshot and
// only link it when the current catalogue still matches its recorded identity.
export function getOrderProductPath(item, products = []) {
  if (item?.id == null || !normalize(item.name)) return null;
  const product = products.find((candidate) => String(candidate.id) === String(item.id));
  if (!product || normalize(product.name) !== normalize(item.name)) return null;
  if (normalize(item.brand) && normalize(product.brand) !== normalize(item.brand)) return null;
  return `/product/${encodeURIComponent(product.id)}`;
}
