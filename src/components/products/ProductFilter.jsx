import { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { MAX_PRICE } from '../../data/products';
import { formatPrice } from '../../utils/helpers';

export default function ProductFilter({
  filters,
  categories = [],
  brands = [],
  maxPrice = MAX_PRICE,
  onChange,
  onClear,
  onFilterApplied,
}) {
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const selectCategory = (category) => {
    setDraftFilters((current) => ({ ...current, category }));
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
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Category</legend>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-3">
          <li>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs leading-tight text-slate-600">
              <input
                type="checkbox"
                checked={draftFilters.category === 'all'}
                onChange={() => selectCategory('all')}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-secondary"
              />
              All Products
            </label>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs leading-tight text-slate-600">
                <input
                  type="checkbox"
                  checked={draftFilters.category === cat.id}
                  onChange={() => selectCategory(cat.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-secondary"
                />
                {cat.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* Brand */}
      <fieldset className="mt-5 border-t border-slate-100 pt-4">
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          Brand{draftFilters.brands.length ? ` (${draftFilters.brands.length})` : ''}
        </legend>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand}>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs leading-tight text-slate-600">
                <input
                  type="checkbox"
                  checked={draftFilters.brands.some(
                    (selectedBrand) => selectedBrand.trim().toLowerCase() === brand.trim().toLowerCase()
                  )}
                  onChange={() => toggleBrand(brand)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-secondary"
                />
                {brand}
              </label>
            </li>
          ))}
        </ul>
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
