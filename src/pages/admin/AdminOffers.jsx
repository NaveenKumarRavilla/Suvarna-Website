import { useState } from 'react';
import { Plus, Trash2, BadgePercent } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { gridCategories } from '../../data/categories';
import Button from '../../components/common/Button';
import {
  Modal,
  Field,
  PageHeader,
  StatusBadge,
  inputCls,
} from '../../components/admin/AdminForm';

const emptyForm = { title: '', description: '', discount: '', category: 'laptops' };

export default function AdminOffers() {
  const { offers, addOffer, updateOffer, deleteOffer } = useAdmin();
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    addOffer({ ...form, active: true });
    setForm(emptyForm);
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Manage Offers"
        subtitle="Promotional offers and deals"
        action={
          <Button variant="secondary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Add Offer
          </Button>
        }
      />

      {offers.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <BadgePercent size={40} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No offers created yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.map((o) => (
            <article key={o.id} className="rounded-xl bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-dark">
                  <BadgePercent size={20} />
                </span>
                <StatusBadge status={o.active ? 'Active' : 'Inactive'} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-primary">{o.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{o.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold text-secondary">
                  {o.discount} &bull; <span className="capitalize">{o.category}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateOffer(o.id, { active: !o.active })}
                    className="text-xs font-semibold text-secondary hover:underline"
                  >
                    {o.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOffer(o.id)}
                    aria-label={`Delete offer ${o.title}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Add Offer" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Offer Title *">
              <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="Festive Laptop Sale" />
            </Field>
            <Field label="Description *">
              <textarea required rows="2" value={form.description} onChange={set('description')} className={inputCls} placeholder="Up to 20% off on business laptops" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Discount Label *">
                <input required value={form.discount} onChange={set('discount')} className={inputCls} placeholder="20%" />
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={set('category')} className={inputCls}>
                  {gridCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                  <option value="all">All Categories</option>
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                Add Offer
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
