import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Copy, Download, Minus, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { normalizeCategoryId } from '../../data/categories';
import { formatPrice } from '../../utils/helpers';
import { getProductPublishabilityIssue } from '../../utils/productQuality';
import { downloadCsv, parseCsv } from '../../utils/csv';
import { apiRequest } from '../../utils/api';
import { fingerprintText } from '../../utils/textFingerprint';
import { clearPendingImportDraft, getPendingImportDraft, rememberPendingImportDraft } from '../../utils/pendingImportDrafts';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import { Field, PageHeader, inputCls, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';

const blankConfiguration = () => ([
  { key: 'Processor', value: '' }, { key: 'RAM', value: '' },
  { key: 'Storage', value: '' }, { key: 'Display', value: '' },
]);

const emptyForm = () => ({
  name: '', sku: '', brand: '', category: 'laptops', price: '', oldPrice: '', stock: 'In Stock', stockQuantity: '', images: [],
  configuration: blankConfiguration(), featured: false, description: '',
  warrantyKind: 'Standard Warranty', warrantyDuration: '1', warrantyUnit: 'Year',
});

const stockOptions = ['In Stock', 'Limited Stock', 'Out of Stock'];
const inlineInputCls = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';
const toSpecKey = (key) => key.trim().toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
const normalizeStockStatus = (value) => stockOptions.find(
  (status) => status.toLowerCase() === String(value || '').trim().toLowerCase()
) || '';
const productCsvHeaders = [
  'id', 'name', 'sku', 'brand', 'category', 'price', 'oldPrice', 'stock', 'stockQuantity',
  'adjustStock', 'expectedStockQuantity', 'featured',
  'description', 'warranty', 'clearImages', 'specs',
  'calculatedRating', 'calculatedReviewCount', 'customerReviewsExportOnly',
];
const calculatedProductFields = new Set([
  'rating',
  'reviews',
  'calculatedRating',
  'calculatedReviewCount',
  'customerReviewsExportOnly',
]);

const parseJsonCell = (value, label, rowNumber, fallback) => {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Row ${rowNumber}: ${label} must contain valid JSON.`);
  }
};

const parseProductCsv = (text) => {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The CSV file must include a header row and at least one product.');
  const aliases = {
    id: 'id', productid: 'id', name: 'name', productname: 'name', brand: 'brand', productbrand: 'brand',
    category: 'category', productcategory: 'category', price: 'price', productprice: 'price',
    oldprice: 'oldPrice', stock: 'stock', stockquantity: 'stockQuantity', availableunits: 'stockQuantity',
    adjuststock: 'adjustStock', expectedstockquantity: 'expectedStockQuantity', featured: 'featured', description: 'description',
    warranty: 'warranty', image: 'image', images: 'images', clearimages: 'clearImages', clearspecs: 'clearSpecs', specs: 'specs',
    rating: 'rating', reviews: 'reviews',
    calculatedrating: 'calculatedRating', averagerating: 'calculatedRating',
    calculatedreviewcount: 'calculatedReviewCount', reviewcount: 'calculatedReviewCount',
    customerreviews: 'customerReviewsExportOnly',
    customerreviewsexportonly: 'customerReviewsExportOnly',
  };
  const headers = rows[0].map((header) => {
    const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return aliases[normalized] || header.trim();
  });
  if (new Set(headers).size !== headers.length) throw new Error('The CSV file contains duplicate column names.');
  const required = ['name', 'brand', 'category', 'price'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`The CSV file is missing required columns: ${missing.join(', ')}.`);

  const seenIds = new Set();
  return rows.slice(1).map((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    const id = (record.id || '').trim();
    if (id && seenIds.has(id)) throw new Error(`Row ${rowNumber}: product ID "${id}" appears more than once in the CSV.`);
    if (id) seenIds.add(id);

    const name = record.name.trim();
    const brand = record.brand.trim();
    const category = record.category.trim();
    const price = Number(record.price);
    const oldPriceValue = (record.oldPrice || '').trim();
    const oldPrice = oldPriceValue ? Number(oldPriceValue) : price;
    if (!name || !brand || !category) throw new Error(`Row ${rowNumber}: name, brand, and category are required.`);
    if (!Number.isFinite(price) || price <= 0) throw new Error(`Row ${rowNumber}: price must be a positive number.`);
    if (!Number.isFinite(oldPrice) || oldPrice <= 0) throw new Error(`Row ${rowNumber}: oldPrice must be a positive number.`);
    const adjustStockValue = (record.adjustStock || '').trim().toLowerCase();
    if (adjustStockValue && !['true', 'false', '1', '0', 'yes', 'no'].includes(adjustStockValue)) {
      throw new Error(`Row ${rowNumber}: adjustStock must be TRUE or FALSE.`);
    }
    const adjustStock = ['true', '1', 'yes'].includes(adjustStockValue);
    const stockValue = (record.stock || '').trim();
    const stockQuantityValue = (record.stockQuantity || '').trim();
    const expectedStockQuantityValue = (record.expectedStockQuantity || '').trim();
    let initialStockQuantity;
    if (stockQuantityValue) {
      initialStockQuantity = Number(stockQuantityValue);
      if (!Number.isInteger(initialStockQuantity) || initialStockQuantity < 0) {
        throw new Error(`Row ${rowNumber}: stockQuantity must be a non-negative whole number.`);
      }
    }
    const initialStockStatus = stockValue
      ? normalizeStockStatus(stockValue)
      : initialStockQuantity === 0 ? 'Out of Stock' : 'In Stock';
    if (stockValue && !initialStockStatus) {
      throw new Error(`Row ${rowNumber}: stock must be In Stock, Limited Stock, or Out of Stock.`);
    }
    if (stockValue && initialStockStatus === 'Limited Stock' && (!Number.isInteger(initialStockQuantity) || initialStockQuantity < 1)) {
      throw new Error(`Row ${rowNumber}: Limited Stock requires stockQuantity of at least 1.`);
    }
    if (stockValue && initialStockStatus === 'In Stock' && initialStockQuantity === 0) {
      throw new Error(`Row ${rowNumber}: a stockQuantity of 0 cannot use In Stock. Set Out of Stock or enter a positive quantity.`);
    }
    if (stockValue && initialStockStatus === 'Out of Stock' && initialStockQuantity == null) {
      initialStockQuantity = 0;
    }
    let stockQuantity;
    let expectedStockQuantity;
    if (adjustStock) {
      if (!expectedStockQuantityValue) {
        throw new Error(`Row ${rowNumber}: set expectedStockQuantity to the current server quantity before setting adjustStock=TRUE.`);
      }
      if (!stockQuantityValue) {
        throw new Error(`Row ${rowNumber}: enter the new stockQuantity when setting adjustStock=TRUE.`);
      }
      stockQuantity = Number(stockQuantityValue);
      expectedStockQuantity = Number(expectedStockQuantityValue);
      if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
        throw new Error(`Row ${rowNumber}: stockQuantity must be a non-negative whole number for an adjustment.`);
      }
      if (!Number.isInteger(expectedStockQuantity) || expectedStockQuantity < 0) {
        throw new Error(`Row ${rowNumber}: expectedStockQuantity must be a non-negative whole number.`);
      }
    }
    const hasImage = Object.hasOwn(record, 'image') && record.image.trim() !== '';
    const images = Object.hasOwn(record, 'images') && record.images.trim() !== ''
      ? parseJsonCell(record.images, 'images', rowNumber, [])
      : undefined;
    const clearImagesValue = (record.clearImages || '').trim().toLowerCase();
    if (clearImagesValue && !['true', 'false', '1', '0', 'yes', 'no'].includes(clearImagesValue)) {
      throw new Error(`Row ${rowNumber}: clearImages must be true or false.`);
    }
    const clearImages = ['true', '1', 'yes'].includes(clearImagesValue);
    const specsValue = (record.specs || '').trim();
    const specs = specsValue ? parseJsonCell(specsValue, 'specs', rowNumber, {}) : undefined;
    const clearSpecsValue = (record.clearSpecs || '').trim().toLowerCase();
    if (clearSpecsValue && !['true', 'false', '1', '0', 'yes', 'no'].includes(clearSpecsValue)) {
      throw new Error(`Row ${rowNumber}: clearSpecs must be true or false.`);
    }
    const clearSpecs = ['true', '1', 'yes'].includes(clearSpecsValue);
    if (!Array.isArray(images) || images.some((image) => typeof image !== 'string')) {
      if (images !== undefined) throw new Error(`Row ${rowNumber}: images must be a JSON array of strings.`);
    }
    if (specs !== undefined && (!specs || typeof specs !== 'object' || Array.isArray(specs))) {
      throw new Error(`Row ${rowNumber}: specs must be a JSON object.`);
    }
    if (clearSpecs && Object.keys(specs || {}).length) {
      throw new Error(`Row ${rowNumber}: provide either non-empty specs or clearSpecs=true, not both.`);
    }

    const featuredValue = (record.featured || '').trim().toLowerCase();
    if (featuredValue && !['true', 'false', '1', '0', 'yes', 'no'].includes(featuredValue)) {
      throw new Error(`Row ${rowNumber}: featured must be true or false.`);
    }
    const product = { name, brand, category, price };
    if (Object.hasOwn(record, 'oldPrice')) product.oldPrice = oldPrice;
    if (Object.hasOwn(record, 'featured')) product.featured = ['true', '1', 'yes'].includes(featuredValue);
    if (Object.hasOwn(record, 'description')) product.description = record.description;
    if (Object.hasOwn(record, 'warranty')) product.warranty = record.warranty;
    if (clearImages) {
      product.image = '';
      product.images = [];
    } else if (images?.length) {
      product.images = images;
      product.image = images[0];
    } else if (hasImage) {
      product.image = record.image.trim();
      product.images = [product.image];
    }
    const hasSpecs = specs && Object.keys(specs).length > 0;
    if (clearSpecs || hasSpecs) product.specs = clearSpecs ? {} : specs;
    for (const [field, value] of Object.entries(record)) {
      if (
        ['id', 'name', 'brand', 'category', 'price', 'oldPrice', 'stock', 'stockQuantity', 'adjustStock', 'expectedStockQuantity', 'featured', 'description', 'warranty', 'image', 'images', 'clearImages', 'specs', 'clearSpecs']
          .includes(field) ||
        calculatedProductFields.has(field)
      ) continue;
      const trimmed = value.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        product[field] = parseJsonCell(value, field, rowNumber, value);
      } else {
        product[field] = value;
      }
    }
    const fields = new Set(Object.keys(record).filter((field) =>
      !calculatedProductFields.has(field) &&
      !['stock', 'stockQuantity', 'adjustStock', 'expectedStockQuantity'].includes(field) &&
      field !== 'clearSpecs' &&
      (field !== 'specs' || clearSpecs || hasSpecs)
    ));
    if (clearSpecs || hasSpecs) fields.add('specs');
    if (Object.hasOwn(product, 'image')) fields.add('image');
    if (Object.hasOwn(product, 'images')) fields.add('images');
    return {
      id,
      product,
      fields,
      rowNumber,
      initialStock: {
        status: initialStockStatus,
        quantity: initialStockQuantity,
      },
      stockAdjustment: {
        enabled: adjustStock,
        status: stockValue,
        quantity: stockQuantity,
        expectedQuantity: expectedStockQuantity,
      },
    };
  });
};

const warrantyFormValues = (warranty = '') => {
  const match = String(warranty).match(/(\d+)\s*(Month|Months|Year|Years)\s*(.*)/i);
  if (!match) return { warrantyDuration: '1', warrantyUnit: 'Year', warrantyKind: 'Standard Warranty' };
  return { warrantyDuration: match[1], warrantyUnit: match[2].toLowerCase().startsWith('month') ? 'Month' : 'Year', warrantyKind: /standard/i.test(match[3]) ? 'Standard Warranty' : 'Brand Warranty' };
};
const PRODUCT_FORM_DRAFT_KEY = 'suvarna_admin_product_form_draft';
const PRODUCT_IMPORT_DRAFT_KEY = 'suvarna_admin_product_import_draft';
const createPendingProductId = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure product ID generation is unavailable in this browser.');
  const suffix = cryptoApi.randomUUID ? cryptoApi.randomUUID() : [...cryptoApi.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `PRD-${suffix}`;
};

export default function AdminProducts() {
  const { products, categories, saveProductBatch, updateProduct, deleteProduct, setAdminFormDirty, getPendingImportIds, rememberPendingImportIds, clearPendingImportIds } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [editBase, setEditBase] = useState(null);
  const [pendingCreateId, setPendingCreateId] = useState(null);
  const [formMode, setFormMode] = useState('add');
  const [formSession, setFormSession] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [categorySearch, setCategorySearch] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const importInputRef = useRef(null);
  const restoredDraftRef = useRef(false);
  const initialFormRef = useRef(JSON.stringify(emptyForm()));
  const uploadingProductImageRef = useRef(false);
  const formSessionRef = useRef(formSession);
  formSessionRef.current = formSession;

  const productCategories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  const categoryOptions = [...new Map([
    ...categories.map((category) => [normalizeCategoryId(category.id), { id: normalizeCategoryId(category.id), label: category.label }]),
    ...productCategories.map((category) => {
      const id = normalizeCategoryId(category);
      return [id, { id, label: category.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }];
    }),
  ]).values()];
  const searchTerm = productSearch.trim().toLowerCase();
  const displayedProducts = products.filter((product) => {
    if (categorySearch !== 'all' && product.category !== categorySearch) return false;
    if (!searchTerm) return true;
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
      product.warranty,
      ...Object.values(product.specs || {}),
    ].join(' ').toLowerCase();
    return searchableText.includes(searchTerm);
  });
  const hiddenFromStorefrontCount = products.filter((product) =>
    Boolean(getProductPublishabilityIssue(product, products))
  ).length;
  const handleProductImageUploading = (busy, scope) => {
    if (scope !== formSessionRef.current) return;
    uploadingProductImageRef.current = busy;
    setUploadingProductImage(busy);
  };

  const openAdd = () => {
    if (uploadingProductImageRef.current) return;
    if (formOpen && JSON.stringify(form) !== initialFormRef.current && !window.confirm('Discard the unsaved product draft and open another product form?')) return;
    const nextForm = emptyForm();
    initialFormRef.current = JSON.stringify(nextForm);
    setFormSession((session) => session + 1);
    setEditing(null); setEditBase(null); setPendingCreateId(null); setFormMode('add'); setForm(nextForm); setFormError(''); setAdminFormDirty(true); setFormOpen(true);
  };
  const openEdit = (product, clone = false) => {
    if (uploadingProductImageRef.current) return;
    if (formOpen && JSON.stringify(form) !== initialFormRef.current && !window.confirm('Discard the unsaved product draft and open another product form?')) return;
    setFormSession((session) => session + 1);
    const productImages = Array.isArray(product.images) && product.images.length ? product.images : product.image ? [product.image] : [];
    const configuration = Object.entries(product.specs || {}).map(([key, value]) => ({ key, value: String(value || '') }));
    const nextForm = {
      name: clone ? `Copy of ${product.name || ''}` : product.name || '',
      sku: clone ? '' : product.sku || product.productCode || '',
      brand: product.brand || '', category: product.category || 'laptops', price: product.price || '', oldPrice: product.oldPrice || '', stock: product.stock || 'In Stock', stockQuantity: product.stockQuantity == null ? '' : String(product.stockQuantity), images: productImages,
      configuration: configuration.length ? configuration : blankConfiguration(), featured: clone ? false : !!product.featured, description: product.description || '', ...warrantyFormValues(product.warranty),
    };
    initialFormRef.current = JSON.stringify(nextForm);
    setEditing(clone ? null : product);
    setEditBase(clone ? null : JSON.stringify(product));
    setPendingCreateId(null);
    setFormMode(clone ? 'clone' : 'edit');
    setFormError('');
    setAdminFormDirty(true);
    setForm(nextForm);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const productId = location.state?.editProductId;
    if (productId === undefined || productId === null) return;
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) return;
    openEdit(product);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, products]);

  useEffect(() => {
    if (restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    if (location.state?.editProductId != null) return;
    try {
      const draft = JSON.parse(localStorage.getItem(PRODUCT_FORM_DRAFT_KEY) || 'null');
      if (!draft?.form || !Array.isArray(draft.form.images) || !Array.isArray(draft.form.configuration)) return;
      const existing = products.find((product) => String(product.id) === String(draft.editingId));
      const isEditing = draft.mode === 'edit' && !!existing;
      setEditing(isEditing ? existing : null);
      setEditBase(isEditing ? (draft.baseRecord || JSON.stringify(existing)) : null);
      setPendingCreateId(draft.pendingCreateId || null);
      setFormMode(isEditing ? 'edit' : draft.mode === 'clone' ? 'clone' : 'add');
      setFormSession((session) => session + 1);
      setForm({ ...emptyForm(), ...draft.form });
      initialFormRef.current = JSON.stringify(emptyForm());
      setFormError('Recovered an unsaved product form from this browser.');
      setFormOpen(true);
      setAdminFormDirty(true);
    } catch (error) {
      console.error('Could not restore the saved product form.', error);
    }
  }, [location.state, products, setAdminFormDirty]);

  useEffect(() => {
    if (!formOpen) return;
    try {
      localStorage.setItem(PRODUCT_FORM_DRAFT_KEY, JSON.stringify({
        form,
        editingId: editing?.id ?? null,
        mode: formMode,
        baseRecord: editBase,
        pendingCreateId,
      }));
    } catch (error) {
      console.error('Could not preserve the product form draft.', error);
    }
  }, [editBase, editing, form, formMode, formOpen, pendingCreateId]);

  useEffect(() => () => setAdminFormDirty(false), [setAdminFormDirty]);

  const closeForm = (saved = false) => {
    if (uploadingProductImageRef.current) return;
    if (!saved && !window.confirm('Discard this product form?')) return;
    setEditing(null);
    setEditBase(null);
    setPendingCreateId(null);
    setFormMode('add');
    setFormOpen(false);
    setAdminFormDirty(false);
    try {
      localStorage.removeItem(PRODUCT_FORM_DRAFT_KEY);
    } catch (error) {
      console.error('Could not clear the product form draft.', error);
    }
  };
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const updateConfiguration = (index, field, value) => setForm((current) => ({ ...current, configuration: current.configuration.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const removeConfiguration = (index) => setForm((current) => ({ ...current, configuration: current.configuration.filter((_, itemIndex) => itemIndex !== index) }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (uploadingProductImageRef.current) return;
    if (uploadingProductImage) {
      setFormError('Wait for the product image upload to finish before saving.');
      return;
    }
    if (editing) {
      const current = products.find((product) => String(product.id) === String(editing.id));
      if (!current || JSON.stringify(current) !== editBase) {
        setFormError('This product changed in another admin session after you opened it. Your draft is preserved; reload the latest record and reapply your changes.');
        return;
      }
    }
    const currentProduct = editing
      ? products.find((product) => String(product.id) === String(editing.id))
      : null;
    const normalizedSku = form.sku.trim().toLowerCase();
    if (normalizedSku && products.some((product) =>
      String(product.id) !== String(currentProduct?.id) &&
      String(product.sku || product.productCode || '').trim().toLowerCase() === normalizedSku
    )) {
      setFormError('This SKU is already assigned to another product. Use a unique SKU for each variant.');
      return;
    }
    const cleanedImages = (form.images || []).filter(Boolean);
    const specs = form.configuration.reduce((result, item) => {
      const key = toSpecKey(item.key || '');
      if (key && item.value.trim()) result[key] = item.value.trim();
      return result;
    }, {});
    const publishabilityIssue = getProductPublishabilityIssue({
      name: form.name,
      brand: form.brand,
      category: form.category,
      description: form.description,
      specs,
    });
    if (publishabilityIssue) {
      setFormError(`This product cannot appear in the storefront: ${publishabilityIssue}`);
      return;
    }
    const stockQuantity = form.stockQuantity === '' ? undefined : Number(form.stockQuantity);
    if (form.stock === 'Limited Stock' && (!Number.isInteger(stockQuantity) || stockQuantity < 1)) {
      setFormError('Enter the available whole-unit quantity before marking this product Limited Stock.');
      return;
    }
    if (form.stock === 'In Stock' && stockQuantity === 0) {
      setFormError('A tracked quantity of 0 cannot be marked In Stock. Enter a positive quantity or clear stock tracking.');
      return;
    }
    if (form.stockQuantity !== '' && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) {
      setFormError('Available units must be a non-negative whole number.');
      return;
    }
    setFormError('');
    const warrantyUnit = Number(form.warrantyDuration) === 1 ? form.warrantyUnit : `${form.warrantyUnit}s`;
    const payload = {
      name: form.name.trim(), sku: form.sku.trim(), brand: form.brand.trim(), category: form.category, price: Number(form.price), oldPrice: form.oldPrice ? Number(form.oldPrice) : Number(form.price), stock: form.stock,
      image: cleanedImages[0] || '', images: cleanedImages, featured: form.featured,
      specs: { ...specs },
      description: form.description.trim(), warranty: `${form.warrantyDuration} ${warrantyUnit} ${form.warrantyKind}`,
    };
    if (stockQuantity !== undefined) payload.stockQuantity = stockQuantity;
    else if (form.stock === 'Out of Stock') payload.stockQuantity = 0;
    else if (currentProduct?.stockQuantity != null) {
      if (!window.confirm('Clear this product’s tracked stock quantity? This removes inventory tracking and may be rejected while active reservations exist.')) return;
      payload.stockQuantity = null;
    }
    setSavingProduct(true);
    try {
      const operationId = editing?.id || pendingCreateId || createPendingProductId();
      if (!editing && !pendingCreateId) {
        setPendingCreateId(operationId);
        try { localStorage.setItem(PRODUCT_FORM_DRAFT_KEY, JSON.stringify({ form, editingId: null, mode: formMode, baseRecord: null, pendingCreateId: operationId })); }
        catch (storageError) { console.error('Could not preserve the product creation ID.', storageError); }
      }
      const saved = await saveProductBatch([{ id: operationId, product: payload }]);
      if (!saved) {
        setFormError('Product was not saved to the database. Your form values are still here; retry after resolving the shared-store error.');
        return;
      }
      closeForm(true);
    } finally {
      setSavingProduct(false);
    }
  };

  const exportProducts = async () => {
    setExporting(true);
    setImportError('');
    setImportStatus('');
    try {
      const { reviews } = await apiRequest('product-reviews-export');
      if (!Array.isArray(reviews)) throw new Error('The review export response was invalid.');
      const reviewsByProduct = new Map();
      reviews.forEach((review) => {
        const key = String(review.productId);
        const productReviews = reviewsByProduct.get(key) || [];
        productReviews.push(review);
        reviewsByProduct.set(key, productReviews);
      });
      const dynamicHeaders = products.flatMap((product) => Object.keys(product))
        .filter((header) => !calculatedProductFields.has(header) &&
          !['image', 'images', 'stock', 'stockQuantity'].includes(header));
      const headers = [...new Set([...productCsvHeaders, ...dynamicHeaders])];
      downloadCsv('suvarna-products.csv', headers, products.map((product) => {
        const productReviews = reviewsByProduct.get(String(product.id)) || [];
        const rating = productReviews.length
          ? productReviews.reduce((sum, review) => sum + Number(review.rating), 0) / productReviews.length
          : 0;
        return headers.map((header) => {
          if (header === 'calculatedRating') return productReviews.length ? rating.toFixed(2) : '';
          if (header === 'calculatedReviewCount') return productReviews.length;
          if (header === 'customerReviewsExportOnly') return JSON.stringify(productReviews);
          if (header === 'adjustStock') return 'FALSE';
          if (header === 'expectedStockQuantity') return product.stockQuantity ?? '';
          const value = product[header];
          return value && typeof value === 'object' ? JSON.stringify(value) : value ?? '';
        });
      }));
      setImportStatus('Routine imports ignore stock values. For a deliberate adjustment, set adjustStock=TRUE and confirm the exported expectedStockQuantity still matches the current product quantity.');
    } catch (error) {
      setImportError(error.message || 'Products and customer reviews could not be exported.');
    } finally {
      setExporting(false);
    }
  };

  const importProducts = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportStatus('');
    let retryStorageAvailable = true;
    let sourceFingerprint = '';
    try {
      const sourceText = await file.text();
      sourceFingerprint = await fingerprintText(sourceText);
      const imported = parseProductCsv(sourceText);
      let pendingImport = null;
      try {
        pendingImport = getPendingImportDraft(localStorage, PRODUCT_IMPORT_DRAFT_KEY, sourceFingerprint);
      } catch (storageError) { retryStorageAvailable = false; console.error('Could not restore product import IDs.', storageError); }
      if (!pendingImport) pendingImport = getPendingImportIds('products', sourceFingerprint);
      const currentProducts = new Map(products.map((product) => [String(product.id), product]));
      let updated = 0;
      let added = 0;
      const operationIds = [];
      const operations = imported.map(({ id, product, fields, rowNumber, initialStock, stockAdjustment }, rowIndex) => {
        const existing = id ? currentProducts.get(id) : null;
        if (existing) {
          const patch = Object.fromEntries(Object.entries(product).filter(([field]) => fields.has(field)));
          if (stockAdjustment.enabled) {
            if (existing.stockQuantity == null || !Number.isInteger(Number(existing.stockQuantity))) {
              throw new Error(`Row ${rowNumber}: this product has no tracked current quantity. Set its quantity in the product editor before importing an adjustment.`);
            }
            if (Number(existing.stockQuantity) !== stockAdjustment.expectedQuantity) {
              throw new Error(`Row ${rowNumber}: expectedStockQuantity is stale (current quantity is ${existing.stockQuantity}). Export the latest products and reapply the adjustment.`);
            }
            const status = normalizeStockStatus(stockAdjustment.status || existing.stock || 'In Stock');
            if (!status) {
              throw new Error(`Row ${rowNumber}: stock must be In Stock, Limited Stock, or Out of Stock for an adjustment.`);
            }
            if (status === 'Limited Stock' && stockAdjustment.quantity < 1) {
              throw new Error(`Row ${rowNumber}: Limited Stock requires at least one available unit.`);
            }
            if (status === 'In Stock' && stockAdjustment.quantity === 0) {
              throw new Error(`Row ${rowNumber}: a tracked quantity of 0 cannot use In Stock. Set Out of Stock or enter a positive quantity.`);
            }
            patch.stock = status;
            patch.stockQuantity = stockAdjustment.quantity;
          }
          operationIds.push(existing.id);
          return { id: existing.id, product: patch };
        }
        const newProduct = { ...product };
        newProduct.stock = initialStock.status;
        if (initialStock.quantity != null) newProduct.stockQuantity = initialStock.quantity;
        delete newProduct.id;
        const pendingId = pendingImport?.ids?.[rowIndex];
        const operationId = pendingId && pendingId !== id ? pendingId : createPendingProductId();
        operationIds.push(operationId);
        return { id: operationId, product: newProduct };
      });
      const pendingIds = { fingerprint: sourceFingerprint, ids: operationIds };
      rememberPendingImportIds('products', pendingIds);
      try { rememberPendingImportDraft(localStorage, PRODUCT_IMPORT_DRAFT_KEY, pendingIds); }
      catch (storageError) { retryStorageAvailable = false; console.error('Could not persist product import IDs.', storageError); }
      if (!await saveProductBatch(operations)) {
        throw new Error(`Products were not saved to the database. Resolve the shared-store error and retry the same import.${retryStorageAvailable ? '' : ' Browser storage is unavailable, so retry in this tab before reloading; the IDs are retained in memory.'}`);
      }
      clearPendingImportIds('products', sourceFingerprint);
      try { clearPendingImportDraft(localStorage, PRODUCT_IMPORT_DRAFT_KEY, sourceFingerprint); } catch (storageError) { console.error('Could not clear product import IDs.', storageError); }
      imported.forEach(({ id }) => {
        if (id && currentProducts.has(id)) updated += 1;
        else added += 1;
      });
      const adjustedCount = imported.filter((item) => item.stockAdjustment.enabled).length;
      setImportStatus(`Imported ${imported.length} product${imported.length === 1 ? '' : 's'}: ${added} added, ${updated} updated${adjustedCount ? `, ${adjustedCount} stock adjustment${adjustedCount === 1 ? '' : 's'} applied` : ''}. Rows without adjustStock=TRUE never update inventory.`);
    } catch (error) {
      setImportError(error.message || `The selected CSV file could not be imported.${retryStorageAvailable ? '' : ' Browser storage is unavailable; retry this same file in this tab before reloading.'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleQuickStockChange = async (product, value) => {
    const status = normalizeStockStatus(value);
    const quantity = product.stockQuantity == null ? null : Number(product.stockQuantity);
    if (status === 'In Stock' && quantity === 0) {
      window.alert('This product has 0 tracked units. Enter a positive quantity in the product editor before marking it In Stock.');
      return;
    }
    if (status === 'Limited Stock' && (!Number.isInteger(quantity) || quantity < 1)) {
      window.alert('Enter at least one tracked unit in the product editor before marking it Limited Stock.');
      return;
    }
    const patch = { stock: status };
    if (status === 'Out of Stock' && quantity !== 0) {
      if (!window.confirm('Mark this product Out of Stock and set its tracked quantity to 0? Active reservations may prevent this change.')) return;
      patch.stockQuantity = 0;
    }
    try {
      if (!await updateProduct(product.id, patch)) {
        window.alert('The stock change was not saved. It may be blocked by an active reservation; refresh the product list and try again.');
      }
    } catch (error) {
      window.alert(error.message || 'The stock change could not be saved.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Products"
        subtitle={`${displayedProducts.length} of ${products.length} products shown`}
        action={
          <>
            <Button type="button" variant="secondary" size="md" onClick={exportProducts} disabled={exporting}><Download size={16} />{exporting ? 'Exporting...' : 'Export CSV'}</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => importInputRef.current?.click()} disabled={importing}>
              <Upload size={16} />{importing ? 'Importing...' : 'Import CSV'}
            </Button>
            <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importProducts} className="hidden" aria-label="Import products from CSV" />
            <form onSubmit={(event) => event.preventDefault()} role="search" className="flex w-full min-w-[280px] max-w-xl flex-1 items-stretch overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-secondary">
              <label htmlFor="product-category-search" className="sr-only">Category</label>
              <select id="product-category-search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} className="max-w-[150px] border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none">
                <option value="all">All Categories</option>
                {productCategories.map((category) => <option key={category} value={category}>{category.replace(/-/g, ' ')}</option>)}
              </select>
              <label htmlFor="admin-product-search" className="sr-only">Search products</label>
              <input id="admin-product-search" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search for products, brands and more..." className="min-w-0 flex-1 px-4 py-2.5 text-sm text-slate-700 outline-none" />
              <button type="submit" aria-label="Search" className="flex items-center gap-2 bg-accent px-4 font-semibold text-navy-900 transition hover:bg-accent-dark hover:text-white"><Search size={18} /><span className="hidden xl:inline">Search</span></button>
            </form>
            <Button variant="secondary" size="md" onClick={openAdd} disabled={uploadingProductImage}><Plus size={16} />Add Product</Button>
          </>
        }
      />

      <p className="mb-4 text-xs text-slate-500">Import merges rows by product ID; matching IDs update supplied product fields, and new products receive generated IDs. Blank image fields preserve existing images; set clearImages to TRUE to remove them. Products can be saved without images and use a display placeholder. Export includes product fields, specifications, and customer reviews, but excludes image columns. Calculated rating, review count, and customer reviews are export-only and ignored during import.</p>
      {importError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{importError}</p>}
      {importStatus && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{importStatus}</p>}

      {hiddenFromStorefrontCount > 0 && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {hiddenFromStorefrontCount} product{hiddenFromStorefrontCount === 1 ? ' is' : 's are'} hidden from customers. The exact reason is shown below each affected product.
        </p>
      )}

      {formOpen && (
        <section className="mb-6 rounded-xl bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-primary">{editing ? 'Edit Product' : formMode === 'clone' ? 'Clone Product' : 'Add Product Details'}</h2><p className="mt-1 text-xs text-slate-500">Changes are saved only when you click {editing ? 'Save Changes' : 'Add Product'}.</p></div>
            <button type="button" onClick={() => closeForm()} disabled={uploadingProductImage} aria-label="Close product form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>}
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-sm font-bold text-primary">Product Details</h3>
                <p className="mt-1 text-xs text-slate-500">Core information customers see first.</p>
                <div className="mt-3 space-y-3">
                  <Field label="Category *"><select value={normalizeCategoryId(form.category)} onChange={set('category')} className={inputCls}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
                  <Field label="Product Name *"><input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Dell Latitude 5440 Laptop" /></Field>
                  <Field label="SKU / Model number"><input value={form.sku} onChange={set('sku')} className={inputCls} placeholder="Optional unique variant identifier" /></Field>
                  <Field label="Brand *"><input required value={form.brand} onChange={set('brand')} className={inputCls} placeholder="Dell" /></Field>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-sm font-bold text-primary">Pricing & Availability</h3>
                <p className="mt-1 text-xs text-slate-500">Set pricing, stock, and homepage visibility.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <Field label="Price (₹) *"><input required type="number" min="1" value={form.price} onChange={set('price')} className={inputCls} placeholder="53990" /></Field>
                  <Field label="Old Price (₹)"><input type="number" min="0" value={form.oldPrice} onChange={set('oldPrice')} className={inputCls} placeholder="65990" /></Field>
                  <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><Field label="Stock Status"><select value={form.stock} onChange={set('stock')} className={inputCls}>{stockOptions.map((status) => <option key={status}>{status}</option>)}</select></Field></div>
                  <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><Field label={form.stock === 'Limited Stock' ? 'Available units *' : 'Available units'}>
                    <input
                      required={form.stock === 'Limited Stock'}
                      type="number"
                      min={form.stock === 'Out of Stock' ? '0' : '1'}
                      step="1"
                      value={form.stockQuantity}
                      onChange={set('stockQuantity')}
                      className={inputCls}
                      placeholder={form.stock === 'Limited Stock' ? 'Enter exact remaining quantity' : 'Optional; leave blank for untracked stock'}
                    />
                  </Field></div>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.featured} onChange={set('featured')} className="h-4 w-4 accent-secondary" />Show in Featured Products</label>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-sm font-bold text-primary">Warranty</h3>
                <p className="mt-1 text-xs text-slate-500">Shown on the product details page.</p>
                <div className="mt-3 space-y-3">
                  <Field label="Warranty Type"><select value={form.warrantyKind} onChange={set('warrantyKind')} className={inputCls}><option>Brand Warranty</option><option>Standard Warranty</option></select></Field>
                  <div className="grid grid-cols-2 gap-3"><Field label="Duration"><input required type="number" min="1" value={form.warrantyDuration} onChange={set('warrantyDuration')} className={inputCls} /></Field><Field label="Period"><select value={form.warrantyUnit} onChange={set('warrantyUnit')} className={inputCls}><option value="Month">Months</option><option value="Year">Years</option></select></Field></div>
                </div>
              </section>
            </div>

            <fieldset className="rounded-xl border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between gap-3"><div><legend className="text-sm font-bold text-primary">Configuration</legend><p className="mt-0.5 text-xs text-slate-500">Add any product specification, such as Processor, RAM, Size, Colour, or Capacity.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, configuration: [...current.configuration, { key: '', value: '' }] }))}><Plus size={14} />Add field</Button></div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Specification</span><span>Value</span>
                  </div>
                  <div className="space-y-2 bg-white p-2">
                    {form.configuration.map((item, index) => (
                      <div key={index} className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-1.5">
                        <input value={item.key} onChange={(event) => updateConfiguration(index, 'key', event.target.value)} className={`${inputCls} bg-white`} placeholder="e.g. Processor" aria-label={`Specification name ${index + 1}`} />
                        <div className="flex min-w-0 gap-2">
                          <input value={item.value} onChange={(event) => updateConfiguration(index, 'value', event.target.value)} className={`${inputCls} min-w-0 bg-white`} placeholder="e.g. Intel Core i5" aria-label={`Specification value ${index + 1}`} />
                          <button type="button" onClick={() => removeConfiguration(index)} aria-label={`Remove configuration ${index + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Minus size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </fieldset>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-3"><Field label="Description"><textarea value={form.description} onChange={set('description')} rows="3" className={inputCls} placeholder="Describe the product, its use cases, and key benefits." /></Field></section>
              <section className="rounded-xl border border-slate-200 p-3"><h3 className="mb-2 text-sm font-bold text-primary">Product Images</h3><ImageUpload key={formSession} scopeKey={formSession} label="Add Image" value={form.images} multiple compact recommendedWidth={1200} recommendedHeight={1200} minimumWidth={600} minimumHeight={600} maximumWidth={2000} maximumHeight={2000} onUploadingChange={handleProductImageUploading} onChange={(value) => setForm((current) => ({ ...current, images: value }))} /></section>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5"><Button type="submit" variant="primary" disabled={savingProduct || uploadingProductImage}>{uploadingProductImage ? 'Uploading image…' : savingProduct ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}</Button><Button type="button" variant="ghost" onClick={() => closeForm()} disabled={savingProduct || uploadingProductImage}>Cancel</Button></div>
          </form>
        </section>
      )}

      <div className={tableWrap}>
        <table className={`${tableCls} min-w-[760px]`}>
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={thCls}>Category</th>
              <th className={thCls}>Product Name</th>
              <th className={thCls}>Price</th>
              <th className={thCls}>Featured</th>
              <th className={thCls}>Warranty</th>
              <th className={thCls}>Stock Status</th>
              <th className={thCls}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedProducts.map((product) => (
              <tr key={product.id} className="align-top transition hover:bg-slate-50">
                <td className={`${tdCls} capitalize`}>{product.category}</td>
                <td className={tdCls}>
                  <input
                    defaultValue={product.name}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== product.name) updateProduct(product.id, { name });
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                    aria-label={`Product name for ${product.name}`}
                    className={`${inlineInputCls} min-w-[180px] font-semibold text-primary`}
                  />
                  {getProductPublishabilityIssue(product, products) && (
                    <p className="mt-1 max-w-xs text-xs font-medium text-amber-700">
                      Not visible: {getProductPublishabilityIssue(product, products)}
                    </p>
                  )}
                </td>
                <td className={tdCls}>
                  <input
                    type="number"
                    min="1"
                    defaultValue={product.price}
                    onBlur={(event) => {
                      const price = Number(event.target.value);
                      if (price > 0 && price !== product.price) updateProduct(product.id, { price });
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                    aria-label={`Price for ${product.name}`}
                    className={`${inlineInputCls} min-w-[100px] font-semibold`}
                  />
                  {product.oldPrice > product.price && <span className="mt-1 block text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>}
                </td>
                <td className={tdCls}><input type="checkbox" checked={!!product.featured} onChange={(event) => updateProduct(product.id, { featured: event.target.checked })} aria-label={`Toggle featured for ${product.name}`} className="h-4 w-4 accent-secondary" /></td>
                <td className={tdCls}>
                  <input
                    defaultValue={product.warranty || 'Standard Warranty'}
                    onBlur={(event) => {
                      const warranty = event.target.value.trim();
                      if (warranty && warranty !== product.warranty) updateProduct(product.id, { warranty });
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                    aria-label={`Warranty for ${product.name}`}
                    className={`${inlineInputCls} min-w-[150px] text-xs`}
                  />
                </td>
                <td className={tdCls}>
                  <select value={normalizeStockStatus(product.stock) || 'In Stock'} onChange={(event) => handleQuickStockChange(product, event.target.value)} aria-label={`Stock status for ${product.name}`} className={`${inlineInputCls} min-w-[140px] text-xs`}>
                    {stockOptions.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
                <td className={tdCls}><span className="flex gap-1"><button type="button" onClick={() => openEdit(product)} disabled={uploadingProductImage} aria-label={`Edit ${product.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"><Pencil size={15} /></button><button type="button" onClick={() => openEdit(product, true)} disabled={uploadingProductImage} aria-label={`Clone ${product.name}`} title="Clone product" className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"><Copy size={15} /></button><button type="button" onClick={async () => { if (!window.confirm(`Delete ${product.name}?`)) return; const deleted = await deleteProduct(product.id); if (!deleted) window.alert('Product was not deleted. It may be reserved by an order, or the database save failed.'); }} aria-label={`Delete ${product.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
