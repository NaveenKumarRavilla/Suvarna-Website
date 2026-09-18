import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { promoCards } from '../../data/banners';

export default function PromoCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:h-[440px] lg:grid-cols-1">
      {promoCards.map((promo) => (
        <Link
          key={promo.id}
          to={promo.link}
          className={`group relative flex min-h-[128px] flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-r ${promo.gradient} p-5 text-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover lg:flex-1`}
        >
          <div className="relative z-10 max-w-[65%]">
            <span className="text-[10px] font-bold tracking-[0.18em] text-white/70">
              {promo.tag}
            </span>
            <h3 className="mt-1 text-lg font-extrabold leading-snug">
              {promo.title}
            </h3>
            <p className="mt-0.5 text-xs text-white/75">{promo.subtitle}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-[11px] font-bold tracking-wide backdrop-blur transition group-hover:bg-accent group-hover:text-navy-900">
              {promo.cta}
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <img
            src={promo.image}
            alt={promo.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="absolute -right-3 bottom-0 h-24 w-24 rounded-tl-2xl object-cover opacity-90 transition-transform duration-300 group-hover:scale-110 sm:h-28 sm:w-28"
          />
        </Link>
      ))}
    </div>
  );
}
