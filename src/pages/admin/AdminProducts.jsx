import { useState } from 'react';
import { Minus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { gridCategories, normalizeCategoryId } from '../../data/categories';
import { formatPrice } from '../../utils/helpers';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import { Field, PageHeader, inputCls, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';

const blankConfiguration = () => ([
  { key: 'Processor', value: '' }, { key: 'RAM', value: '' },
  { key: 'Storage', value: '' }, { key: 'Display', value: '' },
]);

const emptyForm = () => ({
  name: '', brand: '', category: 'laptops', price: '', oldPrice: '', stock: 'In Stock', images: [],
  configuration: blankConfiguration(), featured: false, description: '',
  warrantyKind: 'Standard Warranty', warrantyDuration: '1', warrantyUnit: 'Year',
});

const stockOptions = ['In Stock', 'Limited Stock', 'Out of Stock'];
const inlineInputCls = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';
const toSpecKey = (key) => key.trim().toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');

const warrantyFormValues = (warranty = '') => {
  const match = String(warranty).match(/(\d+)\s*(Month|Months|Year|Years)\s*(.*)/i);
  if (!match) return { warrantyDuration: '1', warrantyUnit: 'Year', warrantyKind: 'Standard Warranty' };
  return { warrantyDuration: match[1], warrantyUnit: match[2].toLowerCase().startsWith('month') ? 'Month' : 'Year', warrantyKind: /standard/i.test(match[3]) ? 'Standard Warranty' : 'Brand Warranty' };
};

export default function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('all');
  const [productSearch, setProductSearch] = useState('');

  const productCategories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  const categoryOptions = [...new Map([
    ...gridCategories.map((category) => [normalizeCategoryId(category.id), { id: normalizeCategoryId(category.id), label: category.label }]),
    ['gaming', { id: 'gaming', label: 'Gaming' }],
    ['refurbished', { id: 'refurbished', label: 'Refurbished' }],
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

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (product) => {
    const productImages = Array.isArray(product.images) && product.images.length ? product.images : product.image ? [product.image] : [];
    const configuration = Object.entries(product.specs || {}).map(([key, value]) => ({ key, value: String(value || '') }));
    setEditing(product);
    setForm({
      name: product.name || '', brand: product.brand || '', category: product.category || 'laptops', price: product.price || '', oldPrice: product.oldPrice || '', stock: product.stock || 'In Stock', images: productImages,
      configuration: configuration.length ? configuration : blankConfiguration(), featured: !!product.featured, description: product.description || '', ...warrantyFormValues(product.warranty),
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeForm = () => { setEditing(null); setFormOpen(false); };
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const updateConfiguration = (index, field, value) => setForm((current) => ({ ...current, configuration: current.configuration.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const removeConfiguration = (index) => setForm((current) => ({ ...current, configuration: current.configuration.filter((_, itemIndex) => itemIndex !== index) }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanedImages = (form.images || []).filter(Boolean);
    const specs = form.configuration.reduce((result, item) => {
      const key = toSpecKey(item.key || '');
      if (key && item.value.trim()) result[key] = item.value.trim();
      return result;
    }, {});
    const warrantyUnit = Number(form.warrantyDuration) === 1 ? form.warrantyUnit : `${form.warrantyUnit}s`;
    const payload = {
      name: form.name.trim(), brand: form.brand.trim(), category: form.category, price: Number(form.price), oldPrice: form.oldPrice ? Number(form.oldPrice) : Number(form.price), stock: form.stock,
      image: cleanedImages[0] || '', images: cleanedImages, featured: form.featured,
      specs: { ...specs, processor: specs.processor || Object.values(specs)[0] || 'Configuration available' },
      description: form.description.trim() || form.name.trim(), warranty: `${form.warrantyDuration} ${warrantyUnit} ${form.warrantyKind}`,
    };
    if (editing) updateProduct(editing.id, payload); else addProduct({ ...payload, rating: 4.5, reviews: 0 });
    closeForm();
  };

  return (
    <div>
      <PageHeader
        title="Manage Products"
        subtitle={`${displayedProducts.length} of ${products.length} products shown`}
        action={
          <>
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
            <Button variant="secondary" size="md" onClick={openAdd}><Plus size={16} />Add Product</Button>
          </>
        }
      />

      {formOpen && (
        <section className="mb-6 rounded-xl bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-primary">{editing ? 'Edit Product' : 'Add Product Details'}</h2><p className="mt-1 text-xs text-slate-500">Changes are saved only when you click {editing ? 'Save Changes' : 'Add Product'}.</p></div>
            <button type="button" onClick={closeForm} aria-label="Close product form" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-sm font-bold text-primary">Product Details</h3>
                <p className="mt-1 text-xs text-slate-500">Core information customers see first.</p>
                <div className="mt-3 space-y-3">
                  <Field label="Category *"><select value={normalizeCategoryId(form.category)} onChange={set('category')} className={inputCls}>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
                  <Field label="Product Name *"><input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Dell Latitude 5440 Laptop" /></Field>
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
              <section className="rounded-xl border border-slate-200 p-3"><h3 className="mb-2 text-sm font-bold text-primary">Product Images</h3><ImageUpload label="Add Image" value={form.images} multiple compact recommendedWidth={1200} recommendedHeight={1200} minimumWidth={600} minimumHeight={600} maximumWidth={2000} maximumHeight={2000} onChange={(value) => setForm((current) => ({ ...current, images: value }))} /></section>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5"><Button type="submit" variant="primary">{editing ? 'Save Changes' : 'Add Product'}</Button><Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button></div>
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
                  <select value={product.stock} onChange={(event) => updateProduct(product.id, { stock: event.target.value })} aria-label={`Stock status for ${product.name}`} className={`${inlineInputCls} min-w-[140px] text-xs`}>
                    {stockOptions.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
                <td className={tdCls}><span className="flex gap-1"><button type="button" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary"><Pencil size={15} /></button><button type="button" onClick={() => deleteProduct(product.id)} aria-label={`Delete ${product.name}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
