import { Link } from 'react-router-dom';
import { BadgePercent } from 'lucide-react';
import { categoryLabel, normalizeCategoryId } from '../../data/categories';
import { useAdmin } from '../../context/AdminContext';

export default function ActiveOffers() {
  const { offers } = useAdmin();
  const activeOffers = offers.filter((offer) => offer.active);
  if (!activeOffers.length) return null;

  return (
    <section aria-labelledby="active-offers-heading" className="mx-auto max-w-8xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-secondary">
          <BadgePercent size={21} />
        </span>
        <div>
          <h2 id="active-offers-heading" className="text-xl font-extrabold text-primary">Current Promotions</h2>
          <p className="text-xs text-slate-500">Campaign details only; product prices are shown from the catalogue.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activeOffers.map((offer) => {
          const category = normalizeCategoryId(offer.category);
          const link = category ? `/products?${new URLSearchParams({ category })}` : '/products';
          return (
            <article key={offer.id} className="flex flex-col rounded-xl border border-accent/50 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-secondary">{offer.discount || 'Special offer'}</p>
              <h3 className="mt-1 text-base font-extrabold text-primary">{offer.title}</h3>
              {offer.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{offer.description}</p>}
              <div className="mt-4 flex items-center justify-between gap-3">
                {category && <span className="text-xs font-semibold text-slate-500">{categoryLabel(category)}</span>}
                <Link to={link} className="ml-auto rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-secondary">
                  Browse products
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
