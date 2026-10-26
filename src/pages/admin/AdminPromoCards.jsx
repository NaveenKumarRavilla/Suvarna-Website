import { useState } from 'react';
import { Images, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import {
  Field,
  inputCls,
  Modal,
  PageHeader,
  StatusBadge,
} from '../../components/admin/AdminForm';

const emptyForm = {
  tag: '',
  title: '',
  subtitle: '',
  cta: 'SHOP NOW',
  link: '/products',
  image: '',
  gradient: 'from-[#071B3D] to-[#0D5DB8]',
};

const gradients = [
  { label: 'Navy to blue', value: 'from-[#071B3D] to-[#0D5DB8]' },
  { label: 'Blue ocean', value: 'from-[#071B3D] via-[#0A2552] to-[#155799]' },
  { label: 'Warm ember', value: 'from-[#7C2D12] to-[#F59E0B]' },
  { label: 'Purple night', value: 'from-[#1E1B4B] to-[#7C3AED]' },
  { label: 'Teal', value: 'from-[#134E4A] to-[#0D9488]' },
  { label: 'Slate', value: 'from-[#1E293B] to-[#475569]' },
];

export default function AdminPromoCards() {
  const { promoCards, addPromoCard, updatePromoCard, deletePromoCard } = useAdmin();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (promo) => {
    setEditingId(promo.id);
    setForm({
      tag: promo.tag || '',
      title: promo.title || '',
      subtitle: promo.subtitle || '',
      cta: promo.cta || '',
      link: promo.link || '/products',
      image: promo.image || '',
      gradient: promo.gradient || gradients[0].value,
    });
    setModalOpen(true);
  };

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      tag: form.tag.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      cta: form.cta.trim(),
      link: form.link.trim(),
    };

    if (editingId !== null) updatePromoCard(editingId, payload);
    else addPromoCard(payload);
    setModalOpen(false);
  };

  const handleDelete = (promo) => {
    if (window.confirm(`Delete the "${promo.title}" promo card?`)) {
      deletePromoCard(promo.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Promo Cards"
        subtitle="Edit the promotional cards beside the homepage hero slider."
        action={
          <Button variant="secondary" size="md" onClick={openAdd}>
            <Plus size={16} />
            Add Promo Card
          </Button>
        }
      />

      {promoCards.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <Images size={40} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No promo cards yet. Add one to feature it on the homepage.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {promoCards.map((promo) => (
            <article key={promo.id} className="rounded-xl bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className={`relative flex min-h-32 min-w-0 flex-1 items-center overflow-hidden rounded-xl bg-gradient-to-r ${promo.gradient || gradients[0].value} p-4 text-white`}>
                  <div className="relative z-10 max-w-[70%]">
                    <p className="text-[10px] font-bold tracking-[0.18em] text-white/70">{promo.tag}</p>
                    <h2 className="mt-1 text-lg font-extrabold">{promo.title}</h2>
                    <p className="mt-0.5 text-xs text-white/75">{promo.subtitle}</p>
                    <span className="mt-2 inline-block rounded-md bg-white/15 px-3 py-1 text-[11px] font-bold">{promo.cta}</span>
                  </div>
                  {promo.image && <img src={promo.image} alt="" className="absolute -right-2 bottom-0 h-24 w-24 rounded-tl-xl object-cover" />}
                </div>
                <StatusBadge status={promo.active === false ? 'Inactive' : 'Active'} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs text-slate-500">{promo.link}</p>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updatePromoCard(promo.id, { active: promo.active === false })}
                    className="text-xs font-semibold text-secondary hover:underline"
                  >
                    {promo.active === false ? 'Show' : 'Hide'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(promo)}
                    aria-label={`Edit ${promo.title}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(promo)}
                    aria-label={`Delete ${promo.title}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editingId === null ? 'Add Promo Card' : 'Edit Promo Card'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tag">
                <input value={form.tag} onChange={set('tag')} className={inputCls} placeholder="HP LASER PRINTERS" />
              </Field>
              <Field label="Button Text *">
                <input required value={form.cta} onChange={set('cta')} className={inputCls} placeholder="SHOP NOW" />
              </Field>
            </div>
            <Field label="Title *">
              <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="Laser Printers" />
            </Field>
            <Field label="Subtitle *">
              <input required value={form.subtitle} onChange={set('subtitle')} className={inputCls} placeholder="Fast, reliable office printing" />
            </Field>
            <Field label="Destination Link *">
              <input required value={form.link} onChange={set('link')} className={inputCls} placeholder="/products?category=printers" />
            </Field>
            <Field label="Background Gradient">
              <select value={form.gradient} onChange={set('gradient')} className={inputCls}>
                {gradients.map((gradient) => (
                  <option key={gradient.value} value={gradient.value}>{gradient.label}</option>
                ))}
              </select>
            </Field>
            <ImageUpload
              label="Card Image"
              value={form.image}
              onChange={(image) => setForm((current) => ({ ...current, image }))}
            />
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                {editingId === null ? 'Add Promo Card' : 'Save Changes'}
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
