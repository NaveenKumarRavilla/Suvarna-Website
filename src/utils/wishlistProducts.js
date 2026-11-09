export const normalizeWishlistProductId = (id) => String(id ?? '').trim();

export const wishlistProductIdentity = (product) => [product.name, product.brand, product.category]
  .map((value) => String(value || '').trim().toLowerCase())
  .join('|');

export const getAvailableWishlistProduct = (savedProduct, productsById) => {
  const product = productsById.get(normalizeWishlistProductId(savedProduct.id));
  if (!product || !['in stock', 'limited stock'].includes(String(product.stock || '').toLowerCase())) return null;
  if (Number.isFinite(Number(product.stockQuantity)) && Number(product.stockQuantity) <= 0) return null;
  return wishlistProductIdentity(savedProduct) === wishlistProductIdentity(product) ? product : null;
};
