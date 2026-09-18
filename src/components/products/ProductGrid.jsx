import { PackageSearch } from 'lucide-react';
import ProductCard from './ProductCard';
import Button from '../common/Button';

export default function ProductGrid({
  products,
  colsClass = 'xl:grid-cols-4',
  onReset,
}) {
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-white py-16 text-center shadow-card">
        <PackageSearch size={48} className="text-slate-300" />
        <div>
          <h3 className="text-lg font-bold text-primary">No products found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters.
          </p>
        </div>
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset}>
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 ${colsClass}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
