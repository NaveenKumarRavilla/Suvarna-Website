import { RotateCcw } from 'lucide-react';
import { navCategories } from '../../data/categories';
import { MAX_PRICE } from '../../data/products';
import { formatPrice } from '../../utils/helpers';

const FILTERABLE = navCategories.filter(
  (c) => !['home', 'contact', 'services', 'offers'].includes(c.id)
);

export default function ProductFilter({ filters, brands = [], maxPrice = MAX_PRICE, onChange, onClear }) {
  const toggleBrand = (brand) => {
    const isSelected = filters.brands.some(
      (selectedBrand) => selectedBrand.trim().toLowerCase() === brand.trim().toLowerCase()
    );
    const next = isSelected
      ? filters.brands.filter((b) => b.trim().toLowerCase() !== brand.trim().toLowerCase())
      : [...filters.brands, brand];
    onChange({ ...filters, brands: next });
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
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          Category
        </h3>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => onChange({ ...filters, category: 'all' })}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                filters.category === 'all'
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
                onClick={() => onChange({ ...filters, category: cat.id })}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  filters.category === cat.id
                    ? 'bg-secondary/10 font-semibold text-secondary'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* Brand */}
      <fieldset className="mt-5 border-t border-slate-100 pt-4">
        <legend className="sr-only">Brand</legend>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          Brand
        </h3>
        <ul className="space-y-2">
          {brands.map((brand) => (
            <li key={brand}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.brands.some(
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
          step="1000"
          value={filters.maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
          aria-label="Maximum price"
          className="w-full accent-secondary"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{formatPrice(5000)}</span>
          <span className="font-semibold text-primary">
            Up to {formatPrice(filters.maxPrice)}
          </span>
        </div>
      </fieldset>
    </div>
  );
}
