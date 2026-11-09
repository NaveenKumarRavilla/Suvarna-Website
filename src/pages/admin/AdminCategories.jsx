import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { categoryIconMap, navCategories, normalizeCategoryId } from '../../data/categories';
import Button from '../../components/common/Button';
import { Field, Modal, PageHeader, inputCls, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';

const gradients = [
  { label: 'Blue', value: 'from-blue-500 to-indigo-600' },
  { label: 'Teal', value: 'from-cyan-500 to-teal-600' },
  { label: 'Green', value: 'from-emerald-500 to-teal-600' },
  { label: 'Purple', value: 'from-violet-500 to-purple-600' },
  { label: 'Rose', value: 'from-rose-500 to-red-600' },
  { label: 'Amber', value: 'from-amber-500 to-orange-600' },
  { label: 'Slate', value: 'from-slate-600 to-slate-800' },
];

const emptyForm = { id: '', label: '', tagline: '', iconKey: 'Package', gradient: gradients[0].value };

export default function AdminCategories() {
  const { products, categories, addCategory, updateCategory, deleteCategory } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const openAdd = () => {
    setEditing(null);
    setError('');
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setError('');
    setForm({ ...emptyForm, ...category });
    setModalOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const label = form.label.trim();
    const id = editing?.id || normalizeCategoryId(label);
    if (!label || !id) {
      setError('Enter a category name.');
      return;
    }
    if (!editing && categories.some((category) => category.id === id)) {
      setError(`A category with the ID "${id}" already exists.`);
      return;
    }
    if (!editing && navCategories.some((category) => (category.path || category.special) && category.id === id)) {
      setError(`"${label}" is reserved for a storefront navigation page.`);
      return;
    }

    const payload = {
      label,
      tagline: form.tagline.trim(),
      iconKey: form.iconKey,
      gradient: form.gradient,
    };
    if (editing) updateCategory(editing.id, payload);
    else addCategory({ ...payload, id });
    setModalOpen(false);
  };

  const handleDelete = (category, count) => {
    if (count > 0) return;
    if (!window.confirm(`Remove the "${category.label}" category?`)) return;
    const removed = deleteCategory(category.id);
    if (!removed) setError('This category now has products assigned to it and cannot be removed.');
  };

  return (
    <div>
      <PageHeader
        title="Manage Categories"
        subtitle={`${categories.length} categories. Categories with products cannot be removed.`}
        action={<Button type="button" variant="secondary" size="md" onClick={openAdd}><Plus size={16} />Add Category</Button>}
      />
      {error && !modalOpen && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={thCls}>Category</th>
              <th className={thCls}>Tagline</th>
              <th className={thCls}>Products</th>
              <th className={thCls}>Status</th>
              <th className={thCls}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((category) => {
              const Icon = categoryIconMap[category.iconKey] || categoryIconMap.Package;
              const count = products.filter((product) => normalizeCategoryId(product.category) === category.id).length;
              return (
                <tr key={category.id} className="transition hover:bg-slate-50">
                  <td className={tdCls}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${category.gradient} text-white`}>
                        <Icon size={17} />
                      </span>
                      <span>
                        <span className="block font-semibold text-primary">{category.label}</span>
                        <span className="block text-[11px] text-slate-400">{category.id}</span>
                      </span>
                    </span>
                  </td>
                  <td className={tdCls}>{category.tagline || '—'}</td>
                  <td className={tdCls}>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${count ? 'bg-secondary/10 text-secondary' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Active</span>
                  </td>
                  <td className={tdCls}>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => openEdit(category)} aria-label={`Edit ${category.label}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary">
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category, count)}
                        aria-label={`Remove ${category.label}`}
                        title={count ? 'Categories with products cannot be removed' : 'Remove category'}
                        disabled={count > 0}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">Category changes sync to the storefront. Add a category before assigning it to products; a category can only be removed when its product count is zero.</p>

      {modalOpen && (
        <Modal title={editing ? `Edit ${editing.label}` : 'Add Category'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <Field label="Category Name *">
              <input autoFocus required maxLength={60} value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} className={inputCls} placeholder="e.g. Smart Home" />
            </Field>
            {editing ? (
              <Field label="Category ID">
                <input value={editing.id} disabled className={`${inputCls} cursor-not-allowed opacity-60`} />
              </Field>
            ) : (
              <p className="-mt-2 text-xs text-slate-500">ID: {normalizeCategoryId(form.label) || 'enter a category name'}</p>
            )}
            <Field label="Tagline">
              <input maxLength={100} value={form.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} className={inputCls} placeholder="A short storefront description" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Icon">
                <select value={form.iconKey} onChange={(event) => setForm((current) => ({ ...current, iconKey: event.target.value }))} className={inputCls}>
                  {Object.keys(categoryIconMap).map((iconKey) => {
                    return <option key={iconKey} value={iconKey}>{iconKey}</option>;
                  })}
                </select>
              </Field>
              <Field label="Color">
                <select value={form.gradient} onChange={(event) => setForm((current) => ({ ...current, gradient: event.target.value }))} className={inputCls}>
                  {gradients.map((gradient) => <option key={gradient.value} value={gradient.value}>{gradient.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">{editing ? 'Save Changes' : 'Add Category'}</Button>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
