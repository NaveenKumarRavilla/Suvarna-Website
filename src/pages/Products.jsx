import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { categoryLabel, navCategories, normalizeCategoryId } from '../data/categories';
import { calcDiscount } from '../utils/helpers';
import ProductGrid from '../components/products/ProductGrid';
import ProductFilter from '../components/products/ProductFilter';

const MAX_FILTER_PRICE = 500000;
const defaultFilters = { category: 'all', brands: [], maxPrice: MAX_FILTER_PRICE };

const normalizeFilterValue = (value = '') => String(value || '').trim().toLowerCase();
const hiddenCategories = ['home', 'contact', 'services', 'offers'];

export default function Products() {
  const { products } = useAdmin();
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').toLowerCase();
  const urlCategory = searchParams.get('category') || 'all';
  const offersOnly = searchParams.get('offers') === 'true';
  const [filters, setFilters] = useState({
    ...defaultFilters,
    category: normalizeCategoryId(urlCategory),
    maxPrice: MAX_FILTER_PRICE,
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const availableCategories = useMemo(() => {
    const categories = new Map(
      navCategories
        .filter((category) => !hiddenCategories.includes(category.id))
        .map((category) => [normalizeCategoryId(category.id), {
          id: normalizeCategoryId(category.id),
          label: category.label,
        }])
    );

    products.forEach((product) => {
      const id = normalizeCategoryId(product.category);
      if (!id || categories.has(id)) return;
      categories.set(id, { id, label: categoryLabel(id) });
    });

    return [...categories.values()];
  }, [products]);

  const availableBrands = useMemo(
    () => [...new Map(
      products
        .map((product) => [normalizeFilterValue(product.brand), String(product.brand || '').trim()])
        .filter(([value, label]) => value && label)
    ).values()].sort((first, second) => first.localeCompare(second)),
    [products]
  );

  useEffect(() => {
    setFilters((f) => ({ ...f, category: normalizeCategoryId(urlCategory), maxPrice: MAX_FILTER_PRICE }));
  }, [urlCategory]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (
          filters.category !== 'all' &&
          normalizeCategoryId(p.category) !== normalizeCategoryId(filters.category)
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

  const handleFiltersApplied = () => {
    setMobileFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-secondary hover:text-secondary"
          aria-expanded={mobileFiltersOpen}
        >
          {mobileFiltersOpen ? <X size={16} /> : <Filter size={16} />}
          Filters
        </button>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-[340px_1fr] lg:gap-8 lg:space-y-0">
        <aside className={mobileFiltersOpen ? 'block' : 'hidden'}>
          <div className="lg:sticky lg:top-24">
            <ProductFilter
              filters={filters}
              categories={availableCategories}
              brands={availableBrands}
              maxPrice={MAX_FILTER_PRICE}
              onChange={setFilters}
              onFilterApplied={handleFiltersApplied}
              onClear={() => {
                setFilters(defaultFilters);
                setMobileFiltersOpen(false);
              }}
            />
          </div>
        </aside>
        <main className={mobileFiltersOpen ? '' : 'lg:col-span-2'}>
          <ProductGrid
            products={filtered}
            colsClass="xl:grid-cols-3 2xl:grid-cols-4"
            onReset={() => setFilters(defaultFilters)}
          />
        </main>
      </div>
    </div>
  );
}
