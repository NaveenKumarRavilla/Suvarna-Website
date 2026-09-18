import { ArrowRight } from 'lucide-react';
import Button from './Button';

export default function SectionHeader({ title, subtitle, actionLabel, actionTo }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-2 h-1 w-12 rounded-full bg-accent" aria-hidden="true" />
        <h2 className="text-xl font-extrabold uppercase tracking-wide text-primary sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actionLabel && actionTo && (
        <Button to={actionTo} variant="outline" size="sm" className="group">
          {actionLabel}
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Button>
      )}
    </div>
  );
}
