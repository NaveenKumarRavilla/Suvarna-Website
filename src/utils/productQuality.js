const VALID_LAPTOP_PROCESSOR = /intel|amd|ryzen|core|ultra|apple|snapdragon|xeon|mediatek|mtk/i;
const PLACEHOLDER_SPEC = /^(configuration available|available)$/i;

const scalarText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '';
  return '';
};

export const getProductPublishabilityIssue = (product) => {
  const name = String(product?.name || '').trim();
  const brand = String(product?.brand || '').trim();
  if (!name || !brand) return 'Add a product name and brand.';

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
