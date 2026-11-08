import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Plus, Pencil, Trash2, Upload, Video, Image as ImageIcon } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import ImageUpload from '../../components/admin/ImageUpload';
import { uploadMediaFile, validateVideoDuration } from '../../utils/media';
import { downloadCsv, parseCsv } from '../../utils/csv';
import { createClientRecordId } from '../../utils/recordId';
import { fingerprintText } from '../../utils/textFingerprint';
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
  mediaFit: 'contain',
};
const gradients = [
  { label: 'Navy → Blue', value: 'from-[#04122B] via-[#071B3D] to-[#0D5DB8]' },
  { label: 'Blue Ocean', value: 'from-[#071B3D] via-[#0A2552] to-[#155799]' },
  { label: 'Bright Blue', value: 'from-[#0A2552] via-[#0D5DB8] to-[#1B75D0]' },
  { label: 'Purple Night', value: 'from-[#1E1B4B] to-[#7C3AED]' },
  { label: 'Warm Ember', value: 'from-[#7C2D12] to-[#F59E0B]' },
];
const bannerCsvHeaders = ['id', 'badge', 'title', 'subtitle', 'cta', 'link', 'image', 'video', 'mediaType', 'mediaFit', 'gradient'];
const BANNER_FORM_DRAFT_KEY = 'suvarna_admin_banner_form_draft';
const BANNER_IMPORT_DRAFT_KEY = 'suvarna_admin_banner_import_draft';

const parseBannerCsv = (text) => {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The CSV file must include a header row and at least one banner.');
  const aliases = {
    id: 'id', badge: 'badge', title: 'title', subtitle: 'subtitle', cta: 'cta', link: 'link',
    image: 'image', video: 'video', gradient: 'gradient',
    bannerid: 'id', badgetext: 'badge', bannertitle: 'title', bannersubtitle: 'subtitle',
    buttontext: 'cta', buttonlabel: 'cta', bannercta: 'cta', targetlink: 'link',
    bannerlink: 'link', bannerimage: 'image', bannervideo: 'video',
    mediatype: 'mediaType', mediafit: 'mediaFit',
  };
  const headers = rows[0].map((header) => {
    const normalized = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return aliases[normalized] || header.trim();
  });
  if (new Set(headers).size !== headers.length) throw new Error('The CSV file contains duplicate column names.');
  if (!headers.includes('title')) throw new Error('The CSV file is missing the required title column.');

  const ids = new Set();
  return rows.slice(1).map((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const record = Object.fromEntries(headers.map((header, index) => {
      const value = cells[index] || '';
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          return [header, JSON.parse(value)];
        } catch {
          throw new Error(`Row ${rowNumber}: ${header} contains invalid JSON.`);
        }
      }
      return [header, value];
    }));
    const id = String(record.id || '').trim();
    if (id && ids.has(id)) throw new Error(`Row ${rowNumber}: banner ID "${id}" appears more than once in the CSV.`);
    if (id) ids.add(id);
    if (!String(record.title || '').trim()) throw new Error(`Row ${rowNumber}: title is required.`);
    const banner = Object.fromEntries(Object.entries(record).filter(([field]) => field !== 'id'));
    if (banner.mediaType && !['image', 'video'].includes(banner.mediaType)) {
      throw new Error(`Row ${rowNumber}: mediaType must be image or video.`);
    }
    return { id, banner };
  });
};

export default function AdminBanners() {
  const { banners, saveBannerBatch, updateBanner, deleteBanner, setAdminFormDirty } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [editBase, setEditBase] = useState(null);
  const [pendingBannerId, setPendingBannerId] = useState(null);
  const [isCloning, setIsCloning] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const importInputRef = useRef(null);
  const pendingBannerImportRef = useRef(null);
  const restoredDraftRef = useRef(false);

  useEffect(() => () => setAdminFormDirty(false), [setAdminFormDirty]);

  useEffect(() => {
    if (restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    try {
      const draft = JSON.parse(localStorage.getItem(BANNER_FORM_DRAFT_KEY) || 'null');
      if (!draft?.form || typeof draft.form !== 'object') return;
      const existing = banners.find((banner) => String(banner.id) === String(draft.editingId));
      setEditing(draft.mode === 'edit' ? existing || null : null);
      setEditBase(draft.mode === 'edit' && existing ? (draft.baseRecord || JSON.stringify(existing)) : null);
      setPendingBannerId(draft.pendingBannerId || null);
      setIsCloning(draft.mode === 'clone');
      setForm({ ...emptyForm, ...draft.form });
      setModalOpen(true);
      setImportError('Recovered an unsaved banner form from this browser.');
      setAdminFormDirty(true);
    } catch (error) {
      console.error('Could not restore the saved banner form.', error);
    }
  }, [banners, setAdminFormDirty]);

  useEffect(() => {
    if (!modalOpen) return;
    try {
      localStorage.setItem(BANNER_FORM_DRAFT_KEY, JSON.stringify({
        form,
        editingId: editing?.id ?? null,
        mode: editing ? 'edit' : isCloning ? 'clone' : 'add',
        baseRecord: editBase,
        pendingBannerId,
      }));
    } catch (error) {
      console.error('Could not preserve the banner form draft.', error);
    }
  }, [editBase, editing, form, isCloning, modalOpen, pendingBannerId]);

  const openAdd = () => {
    setEditing(null);
    setEditBase(null);
    setPendingBannerId(createClientRecordId('BNR'));
    setIsCloning(false);
    setForm(emptyForm);
    setVideoError('');
    setAdminFormDirty(true);
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setEditBase(JSON.stringify(b));
    setPendingBannerId(null);
    setIsCloning(false);
    setForm({
      badge: b.badge,
      title: b.title,
      subtitle: b.subtitle,
      cta: b.cta,
      link: b.link,
      image: b.image || '',
      video: b.video || '',
      mediaType: b.mediaType || (b.video ? 'video' : 'image'),
      mediaFit: b.mediaFit || 'contain',
    });
    setVideoError('');
    setAdminFormDirty(true);
    setModalOpen(true);
  };
  const openClone = (banner) => {
    setEditing(null);
    setEditBase(null);
    setPendingBannerId(createClientRecordId('BNR'));
    setIsCloning(true);
    setForm({
      badge: banner.badge || '',
      title: `Copy of ${banner.title || ''}`,
      subtitle: banner.subtitle || '',
      cta: banner.cta || 'SHOP NOW',
      link: banner.link || '/products',
      image: banner.image || '',
      video: banner.video || '',
      mediaType: banner.mediaType || (banner.video ? 'video' : 'image'),
      mediaFit: banner.mediaFit || 'contain',
      gradient: banner.gradient || gradients[0].value,
    });
    setVideoError('');
    setAdminFormDirty(true);
    setModalOpen(true);
  };
  const closeModal = (saved = false) => {
    if (!saved && !window.confirm('Discard this banner form?')) return;
    setPendingBannerId(null);
    setModalOpen(false);
    setAdminFormDirty(false);
    try {
      localStorage.removeItem(BANNER_FORM_DRAFT_KEY);
    } catch (error) {
      console.error('Could not clear the banner form draft.', error);
    }
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!file.type.startsWith('video/')) throw new Error('Only video files are allowed');
      await validateVideoDuration(file, 10);
      const videoUrl = await uploadMediaFile(file);
      setForm((f) => ({ ...f, video: videoUrl, image: '' }));
      setVideoError('');
    } catch (error) {
      setVideoError(error.message || 'Please choose a valid MP4 or WebM video that is at least 10 seconds long and under 4MB.');
    }

    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      const current = banners.find((banner) => String(banner.id) === String(editing.id));
      if (!current || JSON.stringify(current) !== editBase) {
        setImportError('This banner changed in another admin session after you opened it. Your draft is preserved; reload the latest record and reapply your changes.');
        return;
      }
    }
    const payload = {
      ...form,
      mediaType: form.mediaType || 'image',
      gradient: editing?.gradient || form.gradient || gradients[0].value,
    };

    if (payload.mediaType === 'image') {
      payload.video = '';
    } else {
      payload.image = '';
    }

    setSavingBanner(true);
    try {
      const operationId = editing?.id || pendingBannerId || createClientRecordId('BNR');
      if (!editing && !pendingBannerId) {
        setPendingBannerId(operationId);
        localStorage.setItem(BANNER_FORM_DRAFT_KEY, JSON.stringify({ form, editingId: null, mode: 'add', baseRecord: null, pendingBannerId: operationId }));
      }
      const saved = await saveBannerBatch([{ id: operationId, banner: payload }]);
      if (!saved) {
        setImportError('Banner was not saved to the database. Your form values are still here; retry after resolving the shared-store error.');
        return;
      }
      closeModal(true);
    } finally {
      setSavingBanner(false);
    }
  };

  const exportBanners = () => {
    const headers = [...new Set([...bannerCsvHeaders, ...banners.flatMap((banner) => Object.keys(banner))])];
    downloadCsv(
      'suvarna-banners.csv',
      headers,
      banners.map((banner) => headers.map((header) => {
        const value = banner[header];
        return value && typeof value === 'object' ? JSON.stringify(value) : value ?? '';
      })),
    );
  };

  const importBanners = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportStatus('');
    let retryStorageAvailable = true;
    try {
      const sourceText = await file.text();
      const sourceFingerprint = await fingerprintText(sourceText);
      const imported = parseBannerCsv(sourceText);
      let pendingImport = null;
      try {
        const stored = JSON.parse(localStorage.getItem(BANNER_IMPORT_DRAFT_KEY) || 'null');
        if (stored?.fingerprint === sourceFingerprint && Array.isArray(stored.ids)) pendingImport = stored;
      } catch (storageError) { retryStorageAvailable = false; console.error('Could not restore banner import IDs.', storageError); }
      if (!pendingImport && pendingBannerImportRef.current?.fingerprint === sourceFingerprint) pendingImport = pendingBannerImportRef.current;
      const existingBanners = new Map(banners.map((banner) => [String(banner.id), banner]));
      const plans = imported.map(({ id, banner }, rowIndex) => {
        const existing = id ? existingBanners.get(id) : null;
        if (existing) return { existing, banner, operationId: pendingImport?.ids?.[rowIndex] || existing.id };
        const newBanner = { ...emptyForm, ...banner, gradient: banner.gradient || gradients[0].value };
        const mediaType = banner.mediaType || (newBanner.video ? 'video' : 'image');
        newBanner.mediaType = mediaType;
        if (mediaType === 'video' ? !newBanner.video : !newBanner.image) {
          throw new Error(`New banner "${newBanner.title}" must include its ${mediaType} media.`);
        }
        return { banner: newBanner, operationId: id || pendingImport?.ids?.[rowIndex] || createClientRecordId('BNR') };
      });
      let updated = 0;
      let added = 0;
      const operations = plans.map(({ banner, operationId }) => ({
        id: operationId,
        banner,
      }));
      pendingBannerImportRef.current = { fingerprint: sourceFingerprint, ids: plans.map(({ operationId }) => operationId) };
      try { localStorage.setItem(BANNER_IMPORT_DRAFT_KEY, JSON.stringify(pendingBannerImportRef.current)); }
      catch (storageError) { retryStorageAvailable = false; console.error('Could not persist banner import IDs.', storageError); }
      if (!await saveBannerBatch(operations)) {
        throw new Error(`Banners were not saved to the database. Resolve the shared-store error and retry the same import.${retryStorageAvailable ? '' : ' Browser storage is unavailable, so retry in this tab before reloading; the IDs are retained in memory.'}`);
      }
      pendingBannerImportRef.current = null;
      try { localStorage.removeItem(BANNER_IMPORT_DRAFT_KEY); } catch (storageError) { console.error('Could not clear banner import IDs.', storageError); }
      plans.forEach(({ existing }) => {
        if (existing) updated += 1;
        else added += 1;
      });
      setImportStatus(`Imported ${imported.length} banner${imported.length === 1 ? '' : 's'}: ${added} added, ${updated} updated.`);
    } catch (error) {
      setImportError(error.message || `The selected CSV file could not be imported.${retryStorageAvailable ? '' : ' Browser storage is unavailable; retry this same file in this tab before reloading.'}`);
    } finally {
      setImporting(false);
    }
  };

  const resetBannerCache = () => {
    try {
      localStorage.removeItem('suvarna_hero_banner_index');
      setResetNotice('Banner rotation cache cleared. Your current admin session was not reloaded.');
    } catch {
      setResetNotice('Browser storage is unavailable; the banner cache could not be cleared.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Banners / Sliders"
        subtitle="Hero slider slides shown on the home page"
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={exportBanners} disabled={banners.length === 0}>
              <Download size={16} />Export CSV
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => importInputRef.current?.click()} disabled={importing}>
              <Upload size={16} />{importing ? 'Importing...' : 'Import CSV'}
            </Button>
            <input ref={importInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={importBanners} className="hidden" aria-label="Import banners from CSV" />
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

      <p className="mb-4 text-xs text-slate-500">Banner imports merge matching IDs and add rows with new or blank IDs. Exports include image/video media and all banner fields; large embedded media may produce large CSV files.</p>
      {resetNotice && <p role="status" className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{resetNotice}</p>}
      {importError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{importError}</p>}
      {importStatus && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{importStatus}</p>}

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
                    <button type="button" onClick={() => openClone(b)} aria-label={`Clone ${b.title}`} title="Clone banner" className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary">
                      <Copy size={15} />
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
        <Modal title={editing ? 'Edit Slide' : isCloning ? 'Clone Slide' : 'Add Slide'} onClose={() => closeModal()}>
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

            <Field label="How should the banner media fit?">
              <select value={form.mediaFit} onChange={set('mediaFit')} className={inputCls}>
                <option value="contain">Show full image / video (no crop)</option>
                <option value="cover">Fill the banner area (may crop edges)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Use “Show full” to preserve the complete uploaded media. Empty space is kept around a different aspect ratio.
              </p>
            </Field>

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
              <Button type="submit" variant="primary" className="flex-1" disabled={savingBanner}>
                {savingBanner ? 'Saving…' : editing ? 'Save Changes' : 'Add Slide'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => closeModal()} disabled={savingBanner}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
