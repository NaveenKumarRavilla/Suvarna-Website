import { useEffect, useState } from 'react';
import { Plus, Trash2, BadgePercent } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import { createClientRecordId } from '../../utils/recordId';
import {
  Modal,
  Field,
  PageHeader,
  StatusBadge,
  inputCls,
} from '../../components/admin/AdminForm';

const emptyForm = { title: '', description: '', discount: '', category: 'laptops' };
const OFFER_DRAFT_KEY = 'suvarna_admin_offer_form_draft';

export default function AdminOffers() {
  const { offers, categories, addOffer, updateOffer, deleteOffer } = useAdmin();
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState(null);

  useEffect(() => {
    try { const draft = JSON.parse(localStorage.getItem(OFFER_DRAFT_KEY) || 'null'); if (draft?.form) { setForm({ ...emptyForm, ...draft.form }); setPendingOfferId(draft.pendingId || null); setModalOpen(true); setSaveError('Recovered an unsaved offer form from this browser.'); } }
    catch (error) { console.error('Could not restore offer draft.', error); }
  }, []);
  useEffect(() => {
    if (!modalOpen) return;
    try { localStorage.setItem(OFFER_DRAFT_KEY, JSON.stringify({ form, pendingId: pendingOfferId })); }
    catch (error) { console.error('Could not preserve offer draft.', error); }
  }, [form, modalOpen, pendingOfferId]);

  const openAdd = () => { setForm(emptyForm); setPendingOfferId(createClientRecordId('OFR')); setModalOpen(true); };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const id = pendingOfferId || createClientRecordId('OFR');
    if (!pendingOfferId) {
      setPendingOfferId(id);
      try { localStorage.setItem(OFFER_DRAFT_KEY, JSON.stringify({ form, pendingId: id })); }
      catch (storageError) { console.error('Could not preserve offer creation ID.', storageError); }
    }
    const saved = await addOffer({ ...form, id, active: true });
    setSaving(false);
    if (!saved) { setSaveError('Offer was not confirmed by the database. Your draft is preserved; retry after resolving the shared-store error.'); return; }
    setSaveError('');
    localStorage.removeItem(OFFER_DRAFT_KEY);
    setForm(emptyForm);
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Manage Offers"
        subtitle="Promotional offers and deals"
        action={
            <Button variant="secondary" size="md" onClick={openAdd}>
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
            {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
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
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                  <option value="all">All Categories</option>
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
                {saving ? 'Saving…' : 'Add Offer'}
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
