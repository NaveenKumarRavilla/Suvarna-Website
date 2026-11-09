const VALID_LAPTOP_PROCESSOR = /intel|amd|ryzen|core|ultra|apple|snapdragon|xeon|mediatek|mtk/i;
const PLACEHOLDER_SPEC = /^(configuration available|available)$/i;

const scalarText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '';
  return '';
};

const productNameKey = (product) => [
  String(product?.brand || '').trim().toLowerCase(),
  String(product?.name || '').trim().toLowerCase(),
].join('|');
const productSku = (product) => String(product?.sku || product?.productCode || '').trim().toLowerCase();

export const getProductPublishabilityIssue = (product, products = []) => {
  const name = String(product?.name || '').trim();
  const brand = String(product?.brand || '').trim();
  if (!name || !brand) return 'Add a product name and brand.';
  if (/^copy of\b/i.test(name)) return 'This copied listing needs review and a distinct product name before publishing.';
  if (String(product.stock || '').trim().toLowerCase() === 'limited stock' &&
      (!Number.isInteger(Number(product.stockQuantity)) || Number(product.stockQuantity) < 1)) {
    return 'Limited Stock products need a positive available-unit quantity.';
  }
  const sku = productSku(product);
  const uniqueSku = sku && products.filter((candidate) => productSku(candidate) === sku).length === 1;
  const duplicate = products.some((candidate) => {
    const candidateSku = productSku(candidate);
    const separatelyIdentified = Boolean(uniqueSku && candidateSku !== sku);
    return String(candidate.id) !== String(product.id) &&
      productNameKey(candidate) === productNameKey(product) &&
      products.indexOf(candidate) < products.indexOf(product) &&
      !getProductPublishabilityIssue(candidate) &&
      !separatelyIdentified;
  });
  if (duplicate) return 'This listing duplicates an existing brand and product name; review it and give genuine variants distinct names before publishing.';

  const description = String(product.description || '').trim();
  if (Array.from(description).length < 20) return 'Description must be at least 20 characters.';
  if (description.toLowerCase() === name.toLowerCase()) return 'Description must be different from the product name.';

  const specs = product.specs;
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return 'Specifications must be a key/value object.';
  const completeSpecs = Object.values(specs)
    .map(scalarText)
    .filter((value) => value && !PLACEHOLDER_SPEC.test(value));
  if (completeSpecs.length < 2) return 'Add at least two non-placeholder specifications using text or numeric values.';
  if (String(product.category || '').trim().toLowerCase() === 'laptops' &&
      !VALID_LAPTOP_PROCESSOR.test(scalarText(specs.processor))) {
    return 'Add a recognized laptop processor specification.';
  }
  return '';
};

export const isPublishableProduct = (product) => !getProductPublishabilityIssue(product);

export const getStorefrontProducts = (products) => {
  const published = [];
  const names = new Set();
  const skus = new Set();
  products.forEach((product) => {
    const key = productNameKey(product);
    const sku = productSku(product);
    const hasUniqueSku = sku && !skus.has(sku);
    if (!isPublishableProduct(product) || (names.has(key) && !hasUniqueSku)) return;
    names.add(key);
    if (sku) skus.add(sku);
    published.push(product);
  });
  return published;
};
