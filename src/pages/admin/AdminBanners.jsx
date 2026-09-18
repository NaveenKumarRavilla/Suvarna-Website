import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
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

const emptyForm = { badge: '', title: '', subtitle: '', cta: 'SHOP NOW', link: '/products', image: '' };
const gradients = [
  { label: 'Navy → Blue', value: 'from-[#04122B] via-[#071B3D] to-[#0D5DB8]' },
  { label: 'Blue Ocean', value: 'from-[#071B3D] via-[#0A2552] to-[#155799]' },
  { label: 'Bright Blue', value: 'from-[#0A2552] via-[#0D5DB8] to-[#1B75D0]' },
  { label: 'Purple Night', value: 'from-[#1E1B4B] to-[#7C3AED]' },
  { label: 'Warm Ember', value: 'from-[#7C2D12] to-[#F59E0B]' },
];

export default function AdminBanners() {
  const { banners, addBanner, updateBanner, deleteBanner } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setForm({ badge: b.badge, title: b.title, subtitle: b.subtitle, cta: b.cta, link: b.link, image: b.image });
    setModalOpen(true);
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, gradient: editing?.gradient || gradients[0].value };
    if (editing) updateBanner(editing.id, payload);
    else addBanner(payload);
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Manage Banners / Sliders"
        subtitle="Hero slider slides shown on the home page"
        action={
          <Button variant="secondary" size="md" onClick={openAdd}>
            <Plus size={16} />
            Add Slide
          </Button>
        }
      />

      <div className={tableWrap}>
        <table className={tableCls}>
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={thCls}>Slide</th>
              <th className={thCls}>Title</th>
              <th className={thCls}>CTA</th>
              <th className={thCls}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {banners.map((b, i) => (
              <tr key={b.id} className="transition hover:bg-slate-50">
                <td className={tdCls}>
                  <span className="flex items-center gap-3">
                    <img src={b.image} alt={b.title} loading="lazy" className="h-10 w-16 rounded-md object-cover" />
                    <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                  </span>
                </td>
                <td className={tdCls}>
                  <span className="block max-w-[220px] truncate font-semibold text-primary">{b.title}</span>
                  <span className="block max-w-[220px] truncate text-xs text-slate-400">{b.subtitle}</span>
                </td>
                <td className={tdCls}>
                  <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-bold text-accent-dark">{b.cta}</span>
                </td>
                <td className={tdCls}>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => openEdit(b)} aria-label={`Edit ${b.title}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary">
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => banners.length > 1 && deleteBanner(b.id)}
                      aria-label={`Delete ${b.title}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      disabled={banners.length <= 1}
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
        <Modal title={editing ? 'Edit Slide' : 'Add Slide'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Badge">
                <input value={form.badge} onChange={set('badge')} className={inputCls} placeholder="NEW ARRIVALS" />
              </Field>
              <Field label="CTA Button *">
                <input required value={form.cta} onChange={set('cta')} className={inputCls} placeholder="SHOP NOW" />
              </Field>
            </div>
            <Field label="Title *">
              <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="POWER YOUR POSSIBILITIES" />
            </Field>
            <Field label="Subtitle *">
              <input required value={form.subtitle} onChange={set('subtitle')} className={inputCls} placeholder="Laptops that adapt to you" />
            </Field>
            <Field label="Link *">
              <input required value={form.link} onChange={set('link')} className={inputCls} placeholder="/products?category=laptops" />
            </Field>
            <ImageUpload
              label="Slide Image *"
              value={form.image}
              onChange={(v) => setForm((f) => ({ ...f, image: v }))}
            />
            {editing && (
              <Field label="Background Gradient">
                <select
                  value={editing.gradient}
                  onChange={(e) => updateBanner(editing.id, { gradient: e.target.value })}
                  className={inputCls}
                >
                  {gradients.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                {editing ? 'Save Changes' : 'Add Slide'}
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
