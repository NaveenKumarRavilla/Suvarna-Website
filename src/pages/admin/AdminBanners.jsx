import { useState } from 'react';
import { Plus, Pencil, Trash2, Video, Image as ImageIcon } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import { readVideoFile } from '../../utils/imageUpload';
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
  badge: '',
  title: '',
  subtitle: '',
  cta: 'SHOP NOW',
  link: '/products',
  image: '',
  video: '',
  mediaType: 'image',
};
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
  const [videoError, setVideoError] = useState('');

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setVideoError('');
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setForm({
      badge: b.badge,
      title: b.title,
      subtitle: b.subtitle,
      cta: b.cta,
      link: b.link,
      image: b.image || '',
      video: b.video || '',
      mediaType: b.mediaType || (b.video ? 'video' : 'image'),
    });
    setVideoError('');
    setModalOpen(true);
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith('video/')) throw new Error('Only video files are allowed');
      const dataUrl = await readVideoFile(file, 4, 10);
      setForm((f) => ({ ...f, video: dataUrl, image: '' }));
      setVideoError('');
    } catch (error) {
      setVideoError(error.message || 'Please choose a valid MP4 or WebM video that is at least 10 seconds long and under 4MB.');
    }

    e.target.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      mediaType: form.mediaType || 'image',
      gradient: editing?.gradient || gradients[0].value,
    };

    if (payload.mediaType === 'image') {
      payload.video = '';
    } else {
      payload.image = '';
    }

    try {
      localStorage.removeItem('suvarna_admin_store');
      localStorage.removeItem('suvarna_hero_banner_index');
    } catch {
      // storage unavailable
    }

    if (editing) updateBanner(editing.id, payload);
    else addBanner(payload);
    setModalOpen(false);
  };

  const resetBannerCache = () => {
    try {
      localStorage.removeItem('suvarna_admin_store');
      localStorage.removeItem('suvarna_hero_banner_index');
    } catch {
      // storage unavailable
    }
    window.location.reload();
  };

  return (
    <div>
      <PageHeader
        title="Manage Banners / Sliders"
        subtitle="Hero slider slides shown on the home page"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={openAdd}>
              <Plus size={16} />
              Add Slide
            </Button>
            <Button variant="ghost" size="md" onClick={resetBannerCache} className="border border-red-200 text-red-600 hover:bg-red-50">
              Reset Banner Cache
            </Button>
          </div>
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
                    {b.mediaType === 'video' || b.video ? (
                      <video
                        src={b.video || b.image}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-10 w-16 rounded-md bg-slate-900 object-cover"
                      />
                    ) : (
                      <img src={b.image} alt={b.title} loading="lazy" className="h-10 w-16 rounded-md bg-white object-contain p-0.5" />
                    )}
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

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-700">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <ImageIcon size={14} />
                <span>Banner media guidelines</span>
              </div>
              <p>Image: recommended 1600 × 900 px, minimum 1200 × 675 px, maximum 2400 × 1400 px.</p>
              <p className="mt-1">Video: best 1280 × 720 px, MP4/WebM, minimum 10 sec, under 4MB for local browser storage.</p>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold text-slate-600">Media Type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mediaType: 'image', video: '', image: f.image }))}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    form.mediaType === 'image' ? 'border-secondary bg-secondary/10 text-secondary' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <ImageIcon size={15} />
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mediaType: 'video', image: '' }))}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                    form.mediaType === 'video' ? 'border-secondary bg-secondary/10 text-secondary' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Video size={15} />
                  Video
                </button>
              </div>
            </div>

            {form.mediaType === 'image' ? (
              <ImageUpload
                label="Slide Image *"
                value={form.image}
                recommendedWidth={1600}
                recommendedHeight={900}
                minimumWidth={1200}
                minimumHeight={675}
                maximumWidth={2400}
                maximumHeight={1400}
                onChange={(v) => setForm((f) => ({ ...f, image: v }))}
              />
            ) : (
              <div className="space-y-3">
                <Field label="Short Video *">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    onChange={handleVideoUpload}
                    className="block w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                </Field>

                <Field label="Or paste video URL">
                  <input
                    type="url"
                    value={form.video}
                    onChange={(e) => setForm((f) => ({ ...f, video: e.target.value }))}
                    className={inputCls}
                    placeholder="https://example.com/banner-video.mp4"
                  />
                </Field>

                {videoError && <p className="text-xs font-medium text-red-600">{videoError}</p>}

                {form.video && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    <video src={form.video} controls playsInline muted className="aspect-video w-full object-cover" />
                  </div>
                )}
              </div>
            )}
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
