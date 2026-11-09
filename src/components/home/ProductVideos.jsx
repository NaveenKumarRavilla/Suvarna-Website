import { useMemo, useState } from 'react';
import { categoryLabel, normalizeCategoryId } from '../../data/categories';
import { useAdmin } from '../../context/AdminContext';

export default function ProductVideos() {
  const { videos } = useAdmin();
  const activeVideos = useMemo(() => videos.filter((video) => (
    video.active && /^[A-Za-z0-9_-]{11}$/.test(String(video.youtubeId || ''))
  )), [videos]);
  const categories = useMemo(() => [...new Set(activeVideos.map((video) => normalizeCategoryId(video.category)).filter(Boolean))], [activeVideos]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const visibleVideos = activeVideos.filter((video) => (
    selectedCategory === 'all' || normalizeCategoryId(video.category) === selectedCategory
  ));

  if (!activeVideos.length) return null;

  return (
    <section aria-labelledby="product-videos-heading" className="mx-auto max-w-8xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Watch & learn</p>
          <h2 id="product-videos-heading" className="mt-1 text-2xl font-extrabold text-primary">Product Videos</h2>
        </div>
        <label className="text-sm font-semibold text-slate-600">
          <span className="sr-only">Filter videos by category</span>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleVideos.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-xl bg-white shadow-card">
            <div className="relative aspect-video bg-navy-900">
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}`}
                title={video.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-primary">{video.title}</h3>
              <p className="mt-1 text-xs capitalize text-slate-500">{categoryLabel(normalizeCategoryId(video.category))}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
