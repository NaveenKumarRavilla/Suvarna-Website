import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, Link2 } from 'lucide-react';
import { readImageFile } from '../../utils/imageUpload';

/**
 * Reusable image picker: upload from device (stored as data URL) OR paste a URL.
 * Supports single value (string) and multiple value (array) for admin product images.
 */
export default function ImageUpload({ value = '', onChange, label = 'Image', multiple = false }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');

  const previewImages = Array.isArray(value) ? value : value ? [value] : [];
  const isDataUrl = typeof value === 'string' && value.startsWith('data:');

  useEffect(() => {
    if (!isDataUrl && !multiple && typeof value === 'string') setUrl(value);
  }, [value, isDataUrl, multiple]);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');

    try {
      if (multiple) {
        const uploaded = [];
        for (const file of files) {
          uploaded.push(await readImageFile(file));
        }
        const existing = Array.isArray(value) ? value : value ? [value] : [];
        onChange([...existing, ...uploaded]);
      } else {
        const dataUrl = await readImageFile(files[0]);
        onChange(dataUrl);
      }
    } catch {
      setError('Please choose a valid image file.');
    }

    e.target.value = '';
  };

  const removeAt = (index) => {
    if (multiple) {
      const next = previewImages.filter((_, idx) => idx !== index);
      onChange(next);
    } else {
      onChange('');
    }
  };

  const applyUrl = () => {
    const cleaned = url.trim();
    if (!cleaned) return;

    if (multiple) {
      const existing = Array.isArray(value) ? value : value ? [value] : [];
      onChange([...existing, cleaned]);
    } else {
      onChange(cleaned);
    }

    setUrl('');
    setShowUrl(false);
  };

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>

      <div className={`grid ${multiple ? 'grid-cols-2 gap-2 sm:grid-cols-3' : ''}`}> 
        {previewImages.map((image, idx) => (
          <div key={`${image}-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200">
            <img src={image} alt="Preview" className={multiple ? 'h-28 w-full object-cover' : 'h-36 w-full object-cover'} />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              aria-label="Remove image"
              className="absolute right-2 top-2 rounded-full bg-navy-900/70 p-1.5 text-white transition hover:bg-red-600"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {multiple && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary"
          >
            <UploadCloud size={20} />
            <span className="text-[11px] font-semibold">Add image</span>
          </button>
        )}
      </div>

      {!multiple && !previewImages.length && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary"
        >
          <UploadCloud size={26} />
          <span className="text-xs font-semibold">Upload from device</span>
          <span className="text-[10px] text-slate-400">PNG, JPG up to ~5MB</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        onChange={handleFile}
        className="hidden"
        aria-label={`${label} file input`}
      />

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
        >
          <Link2 size={12} />
          {showUrl ? 'Hide URL input' : 'Or paste image URL'}
        </button>
        {previewImages.length > 0 && !multiple && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-secondary hover:underline"
          >
            Replace
          </button>
        )}
      </div>

      {showUrl && (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={isDataUrl ? '' : url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-secondary"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="shrink-0 rounded-lg bg-secondary px-3 text-xs font-semibold text-white"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
