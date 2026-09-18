import { Loader2 } from 'lucide-react';

export default function Loader({ label = 'Loading...' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-secondary"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={36} className="animate-spin" />
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
