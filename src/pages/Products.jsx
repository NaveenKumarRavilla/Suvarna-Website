import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { categoryLabel, normalizeCategoryId } from '../data/categories';
import { calcDiscount } from '../utils/helpers';
import ProductGrid from '../components/products/ProductGrid';
import ProductFilter from '../components/products/ProductFilter';

const MIN_FILTER_PRICE = 5000;
const PRICE_FILTER_STEP = 5000;
const defaultFilters = (maxPrice) => ({ category: 'all', brands: [], maxPrice });

const normalizeFilterValue = (value = '') => String(value || '').trim().toLowerCase();
const hiddenCategories = ['home', 'contact', 'services', 'offers'];

export default function Products() {
  const { storefrontProducts: products, categories: managedCategories } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').toLowerCase();
  const rawUrlCategory = searchParams.get('category') || 'all';
  const normalizedUrlCategory = normalizeCategoryId(rawUrlCategory);
  const urlCategory = normalizedUrlCategory === 'desktop' ? 'desktops' : normalizedUrlCategory;
  const offersOnly = searchParams.get('offers') === 'true';
  const maxFilterPrice = Math.max(
    500000,
    Math.ceil(Math.max(0, ...products.map((product) => Number(product.price) || 0)) / PRICE_FILTER_STEP) * PRICE_FILTER_STEP
  );
  const urlMaxPrice = Number(searchParams.get('maxPrice'));
  const urlBrands = searchParams.getAll('brand');
  const [filters, setFilters] = useState({
    ...defaultFilters(
      Number.isFinite(urlMaxPrice) && urlMaxPrice >= MIN_FILTER_PRICE
        ? Math.min(maxFilterPrice, urlMaxPrice)
        : maxFilterPrice
    ),
    category: normalizeCategoryId(urlCategory),
    brands: urlBrands,
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isLegacyDesktopCategory = normalizedUrlCategory === 'desktop';

  const availableCategories = useMemo(() => {
    const categoryMap = new Map(
      managedCategories
        .filter((category) => !hiddenCategories.includes(category.id))
        .filter((category) => products.some((product) => normalizeCategoryId(product.category) === category.id))
        .map((category) => [category.id, { id: category.id, label: category.label }])
    );

    products.forEach((product) => {
      const id = normalizeCategoryId(product.category);
      if (!id || categoryMap.has(id)) return;
      categoryMap.set(id, { id, label: categoryLabel(id) });
    });

    return [...categoryMap.values()];
  }, [managedCategories, products]);

  const availableBrands = useMemo(
    () => [...new Map(
      products
        .map((product) => [normalizeFilterValue(product.brand), String(product.brand || '').trim()])
        .filter(([value, label]) => value && label)
    ).values()].sort((first, second) => first.localeCompare(second)),
    [products]
  );

  useEffect(() => {
    if (!isLegacyDesktopCategory) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('category', 'desktops');
    setSearchParams(nextParams, { replace: true });
  }, [isLegacyDesktopCategory, searchParams, setSearchParams]);

  useEffect(() => {
    const urlPrice = Number(searchParams.get('maxPrice'));
    const maxPrice = Number.isFinite(urlPrice) && urlPrice >= MIN_FILTER_PRICE
      ? Math.min(maxFilterPrice, urlPrice)
      : maxFilterPrice;
    setFilters((current) => ({
      ...current,
      category: urlCategory,
      maxPrice,
      brands: searchParams.getAll('brand'),
    }));
  }, [urlCategory, maxFilterPrice, searchParams]);

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

  const categoryName = managedCategories.find((category) => category.id === filters.category)?.label || categoryLabel(filters.category);
  const title = offersOnly
    ? "Today's Offers"
    : search
      ? `Results for "${searchParams.get('search')}"`
      : categoryName;

  const handleFiltersApplied = () => {
    setMobileFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyFilters = (nextFilters) => {
    const normalizedFilters = {
      ...nextFilters,
      category: normalizeCategoryId(nextFilters.category || 'all'),
    };
    setFilters(normalizedFilters);
    const nextParams = new URLSearchParams(searchParams);
    if (normalizedFilters.category === 'all') nextParams.delete('category');
    else nextParams.set('category', normalizedFilters.category);
    if (normalizedFilters.maxPrice >= maxFilterPrice) nextParams.delete('maxPrice');
    else nextParams.set('maxPrice', String(normalizedFilters.maxPrice));
    nextParams.delete('brand');
    normalizedFilters.brands.forEach((brand) => nextParams.append('brand', brand));
    setSearchParams(nextParams);
  };

  const clearCatalogueFilters = () => {
    setFilters(defaultFilters(maxFilterPrice));
    setMobileFiltersOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    ['search', 'category', 'offers', 'maxPrice', 'brand'].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams);
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
              maxPrice={maxFilterPrice}
              onChange={applyFilters}
              onFilterApplied={handleFiltersApplied}
              onClear={clearCatalogueFilters}
            />
          </div>
        </aside>
        <main className={mobileFiltersOpen ? '' : 'lg:col-span-2'}>
          <ProductGrid
            products={filtered}
            colsClass="xl:grid-cols-3 2xl:grid-cols-4"
            onReset={clearCatalogueFilters}
          />
        </main>
      </div>
    </div>
  );
}
