import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { MAX_PRICE } from '../data/products';
import { useAdmin } from '../context/AdminContext';
import { categoryLabel } from '../data/categories';
import { calcDiscount } from '../utils/helpers';
import ProductGrid from '../components/products/ProductGrid';
import ProductFilter from '../components/products/ProductFilter';

const defaultFilters = { category: 'all', brands: [], maxPrice: MAX_PRICE };

const normalizeFilterValue = (value = '') => String(value || '').trim().toLowerCase();

const normalizeCategory = (value = '') =>
  normalizeFilterValue(value).replace(/\s+/g, '-');

export default function Products() {
  const { products } = useAdmin();
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').toLowerCase();
  const urlCategory = searchParams.get('category') || 'all';
  const offersOnly = searchParams.get('offers') === 'true';
  const catalogMaxPrice = useMemo(
    () => Math.max(MAX_PRICE, ...products.map((product) => Number(product.price) || 0)),
    [products]
  );

  const [filters, setFilters] = useState({
    ...defaultFilters,
    category: urlCategory,
    maxPrice: catalogMaxPrice,
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const availableBrands = useMemo(
    () => [...new Map(
      products
        .map((product) => [normalizeFilterValue(product.brand), String(product.brand || '').trim()])
        .filter(([value, label]) => value && label)
    ).values()].sort((first, second) => first.localeCompare(second)),
    [products]
  );

  useEffect(() => {
    setFilters((f) => ({ ...f, category: urlCategory, maxPrice: catalogMaxPrice }));
  }, [urlCategory, catalogMaxPrice]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (
          filters.category !== 'all' &&
          normalizeCategory(p.category) !== normalizeCategory(filters.category)
        ) return false;
        if (offersOnly && calcDiscount(p.price, p.oldPrice) < 15) return false;
        if (
          filters.brands.length &&
          !filters.brands.some(
            (brand) => normalizeFilterValue(brand) === normalizeFilterValue(p.brand)
          )
        ) return false;
        if (p.price > filters.maxPrice) return false;
        if (search) {
          const haystack = `${p.name} ${p.brand} ${p.category} ${Object.values(p.specs).join(' ')}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      }),
    [filters, products, search, offersOnly]
  );

  const title = offersOnly
    ? "Today's Offers"
    : search
      ? `Results for "${searchParams.get('search')}"`
      : categoryLabel(filters.category);

  return (
    <div className="mx-auto max-w-8xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} product{filtered.length === 1 ? '' : 's'} found
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-secondary hover:text-secondary lg:hidden"
          aria-expanded={mobileFiltersOpen}
        >
          {mobileFiltersOpen ? <X size={16} /> : <Filter size={16} />}
          Filters
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
        <aside className={`mb-6 lg:mb-0 lg:block ${mobileFiltersOpen ? 'block' : 'hidden'}`}>
          <div className="lg:sticky lg:top-24">
            <ProductFilter
              filters={filters}
              brands={availableBrands}
              maxPrice={catalogMaxPrice}
              onChange={setFilters}
              onClear={() => setFilters({ ...defaultFilters, maxPrice: catalogMaxPrice })}
            />
          </div>
        </aside>
        <main>
          <ProductGrid
            products={filtered}
            colsClass="xl:grid-cols-3 2xl:grid-cols-4"
            onReset={() => setFilters({ ...defaultFilters, maxPrice: catalogMaxPrice })}
          />
        </main>
      </div>
    </div>
  );
}
