import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { gridCategories } from '../../data/categories';
import { formatPrice } from '../../utils/helpers';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import {
  Modal,
  Field,
  PageHeader,
  inputCls,
  tableWrap,
  tableCls,
  thCls,
  tdCls,
} from '../../components/admin/AdminForm';

const emptyForm = {
  name: '',
  brand: '',
  category: 'laptops',
  price: '',
  oldPrice: '',
  stock: 'In Stock',
  images: [],
  processor: '',
  ram: '',
  storage: '',
  display: '',
  featured: false,
};

const stockOptions = ['In Stock', 'Limited Stock', 'Out of Stock'];

export default function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct } = useAdmin();
  const [editing, setEditing] = useState(null); // product or null
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    const productImages = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      oldPrice: p.oldPrice || '',
      stock: p.stock,
      images: productImages,
      processor: p.specs?.processor || '',
      ram: p.specs?.ram || '',
      storage: p.specs?.storage || '',
      display: p.specs?.display || '',
      featured: !!p.featured,
    });
    setModalOpen(true);
  };

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedImages = (form.images || []).filter(Boolean);
    const primaryImage = cleanedImages[0] || '';

    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : Number(form.price),
      stock: form.stock,
      image: primaryImage,
      images: cleanedImages,
      featured: form.featured,
      specs: {
        processor: form.processor,
        ram: form.ram,
        storage: form.storage,
        display: form.display,
        graphics: form.processor,
        os: 'Windows 11',
      },
    };
    if (editing) {
      updateProduct(editing.id, payload);
    } else {
      addProduct({
        ...payload,
        rating: 4.5,
        reviews: 0,
        warranty: '1 Year Standard Warranty',
        description: form.name,
      });
    }
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Manage Products"
        subtitle={`${products.length} products in catalog`}
        action={
          <Button variant="secondary" size="md" onClick={openAdd}>
            <Plus size={16} />
            Add Product
          </Button>
        }
      />

      <div className={tableWrap}>
        <table className={tableCls}>
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={thCls}>Product</th>
              <th className={thCls}>Category</th>
              <th className={thCls}>Price</th>
              <th className={thCls}>Stock</th>
              <th className={thCls}>Featured</th>
              <th className={thCls}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="transition hover:bg-slate-50">
                <td className={tdCls}>
                  <span className="block max-w-[260px] truncate font-semibold text-primary">
                    {p.name}
                  </span>
                  <span className="text-xs text-slate-400">{p.brand}</span>
                </td>
                <td className={`${tdCls} capitalize`}>{p.category}</td>
                <td className={tdCls}>
                  <span className="font-semibold">{formatPrice(p.price)}</span>
                  {p.oldPrice > p.price && (
                    <span className="ml-2 text-xs text-slate-400 line-through">
                      {formatPrice(p.oldPrice)}
                    </span>
                  )}
                </td>
                <td className={tdCls}>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      p.stock === 'In Stock'
                        ? 'bg-emerald-100 text-emerald-700'
                        : p.stock === 'Limited Stock'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {p.stock}
                  </span>
                </td>
                <td className={tdCls}>
                  <input
                    type="checkbox"
                    checked={!!p.featured}
                    onChange={(e) => updateProduct(p.id, { featured: e.target.checked })}
                    aria-label={`Toggle featured for ${p.name}`}
                    className="h-4 w-4 accent-secondary"
                  />
                </td>
                <td className={tdCls}>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(p.id)}
                      aria-label={`Delete ${p.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Product Name *">
              <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Dell Latitude 5440 Laptop" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand *">
                <input required value={form.brand} onChange={set('brand')} className={inputCls} placeholder="Dell" />
              </Field>
              <Field label="Category *">
                <select value={form.category} onChange={set('category')} className={inputCls}>
                  {gridCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                  <option value="gaming">Gaming</option>
                </select>
              </Field>
              <Field label="Price (₹) *">
                <input required type="number" min="1" value={form.price} onChange={set('price')} className={inputCls} placeholder="53990" />
              </Field>
              <Field label="Old Price (₹)">
                <input type="number" min="0" value={form.oldPrice} onChange={set('oldPrice')} className={inputCls} placeholder="65990" />
              </Field>
              <Field label="Stock Status">
                <select value={form.stock} onChange={set('stock')} className={inputCls}>
                  {stockOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <ImageUpload
              label="Product Images *"
              value={form.images}
              multiple
              recommendedWidth={1200}
              recommendedHeight={1200}
              minimumWidth={600}
              minimumHeight={600}
              maximumWidth={2000}
              maximumHeight={2000}
              onChange={(v) => setForm((f) => ({ ...f, images: v }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Processor">
                <input value={form.processor} onChange={set('processor')} className={inputCls} placeholder="Intel Core i5-1235U" />
              </Field>
              <Field label="RAM">
                <input value={form.ram} onChange={set('ram')} className={inputCls} placeholder="8GB DDR4" />
              </Field>
              <Field label="Storage">
                <input value={form.storage} onChange={set('storage')} className={inputCls} placeholder="512GB SSD" />
              </Field>
              <Field label="Display">
                <input value={form.display} onChange={set('display')} className={inputCls} placeholder='14" FHD' />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} className="h-4 w-4 accent-secondary" />
              Show in Featured Products
            </label>
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                {editing ? 'Save Changes' : 'Add Product'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
