import { Link, useLocation } from 'react-router-dom';
import { navCategories } from '../../data/categories';
import { categoryLink } from './MobileHeader';

export default function CategoryNav() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeCategory = params.get('category');
  const offersActive = params.get('offers') === 'true';

  const isActive = (cat) => {
    if (cat.id === 'home') return location.pathname === '/';
    if (cat.id === 'offers') return location.pathname === '/products' && offersActive;
    if (cat.path) return location.pathname === cat.path;
    return location.pathname === '/products' && activeCategory === cat.id;
  };

  return (
    <nav
      aria-label="Product categories"
      className="border-b border-slate-200 bg-white shadow-sm"
    >
      <div className="no-scrollbar mx-auto flex max-w-8xl items-stretch gap-1 overflow-x-auto px-3">
        {navCategories.map((cat) => {
          const active = isActive(cat);
          const Icon = cat.icon;
          return (
            <Link
              key={cat.id}
              to={categoryLink(cat)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-[68px] flex-col items-center gap-1 border-b-2 px-3 py-2.5 text-[11px] font-medium transition sm:text-xs ${
                active
                  ? 'border-accent text-secondary'
                  : cat.special
                    ? 'border-transparent text-accent-dark hover:bg-amber-50'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-secondary'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span className="whitespace-nowrap">{cat.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
