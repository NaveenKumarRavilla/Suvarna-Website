import { useState } from 'react';
import { Plus, Trash2, Youtube } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import {
  Modal,
  Field,
  PageHeader,
  StatusBadge,
  inputCls,
} from '../../components/admin/AdminForm';

const emptyForm = { title: '', youtubeId: '', category: 'laptops' };

export default function AdminVideos() {
  const { videos, addVideo, updateVideo, deleteVideo } = useAdmin();
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const extractId = (value) => {
    const match = value.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
    return match ? match[1] : value.trim();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addVideo({ ...form, youtubeId: extractId(form.youtubeId), active: true });
    setForm(emptyForm);
    setModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Manage Videos"
        subtitle="Product videos embedded on the store"
        action={
          <Button variant="secondary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Add Video
          </Button>
        }
      />

      {videos.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <Youtube size={40} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No videos added yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((v) => (
            <article key={v.id} className="overflow-hidden rounded-xl bg-white shadow-card">
              <div className="relative aspect-video bg-navy-900">
                <iframe
                  src={`https://www.youtube.com/embed/${v.youtubeId}`}
                  title={v.title}
                  loading="lazy"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="p-4">
                <h3 className="line-clamp-1 text-sm font-semibold text-primary">{v.title}</h3>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-[11px] font-bold capitalize text-secondary">
                    {v.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.active ? 'Active' : 'Inactive'} />
                    <button
                      type="button"
                      onClick={() => updateVideo(v.id, { active: !v.active })}
                      className="text-xs font-semibold text-secondary hover:underline"
                    >
                      {v.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVideo(v.id)}
                      aria-label={`Delete ${v.title}`}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Add Video" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Video Title *">
              <input required value={form.title} onChange={set('title')} className={inputCls} placeholder="Dell Latitude 5440 Review" />
            </Field>
            <Field label="YouTube URL or Video ID *">
              <input required value={form.youtubeId} onChange={set('youtubeId')} className={inputCls} placeholder="https://youtube.com/watch?v=..." />
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={set('category')} className={inputCls} placeholder="laptops" />
            </Field>
            <div className="flex gap-3 pt-1">
              <Button type="submit" variant="primary" className="flex-1">
                Add Video
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
