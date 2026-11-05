const VALID_LAPTOP_PROCESSOR = /intel|amd|ryzen|core|ultra|apple|snapdragon|xeon|mediatek|mtk/i;
const PLACEHOLDER_SPEC = /^(configuration available|available)$/i;

export const isPublishableProduct = (product) => {
  if (!product || !String(product.name || '').trim() || !String(product.brand || '').trim()) return false;
  const description = String(product.description || '').trim();
  if (description.length < 20 || description.toLowerCase() === String(product.name).trim().toLowerCase()) return false;
  const specs = product.specs;
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return false;
  const completeSpecs = Object.values(specs).filter(
    (value) => String(value || '').trim() && !PLACEHOLDER_SPEC.test(String(value).trim())
  );
  if (completeSpecs.length < 2) return false;
  if (String(product.category || '').toLowerCase() === 'laptops' &&
      !VALID_LAPTOP_PROCESSOR.test(String(specs.processor || ''))) return false;
  return true;
};
