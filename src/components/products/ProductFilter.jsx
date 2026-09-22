import { useEffect, useState } from 'react';
import { ChevronDown, Minus, Plus, RotateCcw } from 'lucide-react';
import { navCategories } from '../../data/categories';
import { MAX_PRICE } from '../../data/products';
import { formatPrice } from '../../utils/helpers';

const FILTERABLE = navCategories.filter(
  (c) => !['home', 'contact', 'services', 'offers'].includes(c.id)
);

export default function ProductFilter({
  filters,
  brands = [],
  maxPrice = MAX_PRICE,
  onChange,
  onClear,
  onFilterApplied,
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const selectCategory = (category) => {
    setDraftFilters((current) => ({ ...current, category }));
    setCategoryOpen(false);
  };

  const toggleBrand = (brand) => {
    const isSelected = draftFilters.brands.some(
      (selectedBrand) => selectedBrand.trim().toLowerCase() === brand.trim().toLowerCase()
    );
    const next = isSelected
      ? draftFilters.brands.filter((b) => b.trim().toLowerCase() !== brand.trim().toLowerCase())
      : [...draftFilters.brands, brand];
    setDraftFilters((current) => ({ ...current, brands: next }));
  };

  const changePrice = (nextPrice) => {
    const price = Math.min(maxPrice, Math.max(5000, nextPrice));
    setDraftFilters((current) => ({ ...current, maxPrice: price }));
  };

  const applyFilters = () => {
    onChange(draftFilters);
    setCategoryOpen(false);
    setBrandOpen(false);
    onFilterApplied?.();
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
          Filters
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-primary"
        >
          <RotateCcw size={12} />
          Clear All
        </button>
      </div>

      {/* Category */}
      <fieldset className="border-t border-slate-100 pt-4">
        <legend className="sr-only">Category</legend>
        <button
          type="button"
          onClick={() => setCategoryOpen((open) => !open)}
          aria-expanded={categoryOpen}
          className="flex w-full items-center justify-between py-1 text-left text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary"
        >
          <span>Category{draftFilters.category !== 'all' ? `: ${navCategories.find((cat) => cat.id === draftFilters.category)?.label || draftFilters.category}` : ''}</span>
          <ChevronDown size={16} className={`transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
        </button>
        {categoryOpen && <ul className="mt-2.5 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => selectCategory('all')}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                draftFilters.category === 'all'
                  ? 'bg-secondary/10 font-semibold text-secondary'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Products
            </button>
          </li>
          {FILTERABLE.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => selectCategory(cat.id)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  draftFilters.category === cat.id
                    ? 'bg-secondary/10 font-semibold text-secondary'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>}
      </fieldset>

      {/* Brand */}
      <fieldset className="mt-5 border-t border-slate-100 pt-4">
        <legend className="sr-only">Brand</legend>
        <button
          type="button"
          onClick={() => setBrandOpen((open) => !open)}
          aria-expanded={brandOpen}
          className="flex w-full items-center justify-between py-1 text-left text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-primary"
        >
          <span>Brand{draftFilters.brands.length ? ` (${draftFilters.brands.length})` : ''}</span>
          <ChevronDown size={16} className={`transition-transform ${brandOpen ? 'rotate-180' : ''}`} />
        </button>
        {brandOpen && <div className="mt-2.5">
          <ul className="space-y-2">
          {brands.map((brand) => (
            <li key={brand}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={draftFilters.brands.some(
                    (selectedBrand) => selectedBrand.trim().toLowerCase() === brand.trim().toLowerCase()
                  )}
                  onChange={() => toggleBrand(brand)}
                  className="h-4 w-4 rounded border-slate-300 accent-secondary"
                />
                {brand}
              </label>
            </li>
          ))}
          </ul>
        </div>}
      </fieldset>

      {/* Price */}
      <fieldset className="mt-5 border-t border-slate-100 pt-4">
        <legend className="sr-only">Maximum price</legend>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          Max Price
        </h3>
        <input
          type="range"
          min="5000"
          max={maxPrice}
          step="5000"
          value={draftFilters.maxPrice}
          onChange={(e) => changePrice(Number(e.target.value))}
          aria-label="Maximum price"
          className="w-full accent-secondary"
        />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{formatPrice(5000)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changePrice(draftFilters.maxPrice - 5000)}
              disabled={draftFilters.maxPrice <= 5000}
              aria-label="Decrease maximum price by ₹5,000"
              className="rounded-md border border-slate-200 p-1 text-primary transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span className="font-semibold text-primary">
            Up to {formatPrice(draftFilters.maxPrice)}
            </span>
            <button
              type="button"
              onClick={() => changePrice(draftFilters.maxPrice + 5000)}
              disabled={draftFilters.maxPrice >= maxPrice}
              aria-label="Increase maximum price by ₹5,000"
              className="rounded-md border border-slate-200 p-1 text-primary transition hover:border-secondary hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={applyFilters}
        className="mt-6 w-full rounded-lg bg-secondary px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary"
      >
        Apply Filters
      </button>
    </div>
  );
}
