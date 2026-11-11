import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, Link2, Image as ImageIcon } from 'lucide-react';
import { getImageDimensions } from '../../utils/imageUpload';
import { uploadMediaFile } from '../../utils/media';

/**
 * Reusable image picker: upload from device to shared media storage OR paste a URL.
 * Supports single value (string) and multiple value (array) for admin product images.
 */
export default function ImageUpload({
  value = '',
  onChange,
  label = 'Image',
  multiple = false,
  recommendedWidth = null,
  recommendedHeight = null,
  minimumWidth = null,
  minimumHeight = null,
  maximumWidth = null,
  maximumHeight = null,
  compact = false,
  onUploadingChange,
  scopeKey,
}) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [imageMeta, setImageMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const activeRef = useRef(true);
  const currentScopeRef = useRef(scopeKey);
  const uploadingChangeRef = useRef(onUploadingChange);
  currentScopeRef.current = scopeKey;
  uploadingChangeRef.current = onUploadingChange;

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (uploadingRef.current) uploadingChangeRef.current?.(false, scopeKey);
    };
  }, [scopeKey]);

  const previewImages = Array.isArray(value) ? value : value ? [value] : [];
  const isDataUrl = typeof value === 'string' && value.startsWith('data:');
  const recommendedText = recommendedWidth && recommendedHeight
    ? `Good size: ${recommendedWidth} × ${recommendedHeight}px`
    : 'Use a high-quality image';
  const minText = minimumWidth && minimumHeight ? `Minimum: ${minimumWidth} × ${minimumHeight}px` : '';
  const maxText = maximumWidth && maximumHeight ? `Large image accepted up to ${maximumWidth} × ${maximumHeight}px` : '';
  const guideText = [recommendedText, minText, maxText].filter(Boolean).join(' • ');

  useEffect(() => {
    if (!isDataUrl && !multiple && typeof value === 'string') setUrl(value);
  }, [value, isDataUrl, multiple]);

  const handleFile = async (e) => {
    if (uploadingRef.current) {
      e.target.value = '';
      return;
    }
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');

    const uploadScope = scopeKey;
    uploadingRef.current = true;
    setUploading(true);
    onUploadingChange?.(true, uploadScope);
    try {
      const dimensions = await getImageDimensions(files[0]);
      setImageMeta(dimensions);

      if (recommendedWidth && recommendedHeight) {
        const ratioDifference = Math.abs((dimensions.width / dimensions.height) - (recommendedWidth / recommendedHeight));
        const isTooSmall = minimumWidth && minimumHeight ? dimensions.width < minimumWidth || dimensions.height < minimumHeight : false;
        const isTooLarge = maximumWidth && maximumHeight ? dimensions.width > maximumWidth || dimensions.height > maximumHeight : false;

        if (isTooSmall || isTooLarge || ratioDifference > 0.45) {
          const warningMessage = isTooSmall
            ? `Image is smaller than recommended. Try a sharper image around ${recommendedWidth} × ${recommendedHeight}px.`
            : isTooLarge
              ? `This image is larger than ideal. Best to keep it within ${maximumWidth} × ${maximumHeight}px.`
              : `This image ratio is not ideal. Better to use ${recommendedWidth} × ${recommendedHeight}px.`;

          setError(`${warningMessage} Current file: ${dimensions.width} × ${dimensions.height}px.`);
        } else {
          setError('');
        }
      }

      if (multiple) {
        const uploaded = [];
        for (const file of files) {
          uploaded.push(await uploadMediaFile(file));
        }
        const existing = Array.isArray(value) ? value : value ? [value] : [];
        if (activeRef.current && currentScopeRef.current === uploadScope) onChange([...existing, ...uploaded]);
      } else {
        const uploaded = await uploadMediaFile(files[0]);
        if (activeRef.current && currentScopeRef.current === uploadScope) onChange(uploaded);
      }
    } catch (uploadError) {
      if (activeRef.current && currentScopeRef.current === uploadScope) {
        setError(uploadError.message || 'Please choose a valid image file.');
      }
    } finally {
      uploadingRef.current = false;
      if (activeRef.current) setUploading(false);
      onUploadingChange?.(false, uploadScope);
    }

    e.target.value = '';
  };

  const removeAt = (index) => {
    if (uploadingRef.current) return;
    if (multiple) {
      const next = previewImages.filter((_, idx) => idx !== index);
      onChange(next);
    } else {
      onChange('');
    }
  };

  const applyUrl = () => {
    if (uploadingRef.current) return;
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

      {(recommendedWidth || recommendedHeight || minimumWidth || maximumWidth) && (
        <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          <div className="flex items-center gap-1.5 font-semibold">
            <ImageIcon size={12} />
            <span>{guideText}</span>
          </div>
          {imageMeta && (
            <div className="mt-1 text-blue-600">Selected image: {imageMeta.width} × {imageMeta.height}px</div>
          )}
        </div>
      )}

      <div className={`grid ${multiple ? (compact ? 'grid-cols-3 gap-2 sm:grid-cols-4' : 'grid-cols-2 gap-2 sm:grid-cols-3') : ''}`}>
        {previewImages.map((image, idx) => (
          <div key={`${image}-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img src={image} alt="Preview" className={multiple ? (compact ? 'h-20 w-full object-contain p-1' : 'h-28 w-full object-contain p-1') : 'h-36 w-full object-contain p-1'} />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              disabled={uploading}
              aria-label="Remove image"
              className="absolute right-2 top-2 rounded-full bg-navy-900/70 p-1.5 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {multiple && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'h-20' : 'h-28'}`}
          >
            <UploadCloud size={20} />
            <span className="text-[11px] font-semibold">{uploading ? 'Uploading…' : 'Add image'}</span>
          </button>
        )}
      </div>

      {!multiple && !previewImages.length && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud size={26} />
          <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Upload from device'}</span>
          <span className="text-[10px] text-slate-400">JPEG, PNG, WebP, GIF, AVIF up to 4 MB</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        disabled={uploading}
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
          onClick={() => {
            if (!uploadingRef.current) setShowUrl((s) => !s);
          }}
          disabled={uploading}
          className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Link2 size={12} />
          {showUrl ? 'Hide URL input' : 'Or paste image URL'}
        </button>
        {previewImages.length > 0 && !multiple && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs font-medium text-secondary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
            onChange={(e) => {
              if (!uploadingRef.current) setUrl(e.target.value);
            }}
            disabled={uploading}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-secondary"
          />
          <button
            type="button"
            onClick={applyUrl}
            disabled={uploading}
            className="shrink-0 rounded-lg bg-secondary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
