import { useRef } from 'react';
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
import ProductCard from './ProductCard';
import Button from '../common/Button';

export default function ProductGrid({
  products,
  colsClass = 'xl:grid-cols-4',
  onReset,
}) {
  const scrollRef = useRef(null);

  const scrollProducts = (direction) => {
    const container = scrollRef.current;
    if (!container) return;

    const firstCard = container.querySelector('[data-product-card-wrapper]');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width + 12 : 260;
    container.scrollBy({
      left: direction * cardWidth,
      behavior: 'smooth',
    });
  };

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
    <div className="relative">
      <div className="mb-3 flex items-center justify-end gap-2 md:hidden">
        <button
          type="button"
          onClick={() => scrollProducts(-1)}
          aria-label="Scroll products left"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-secondary hover:text-secondary"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => scrollProducts(1)}
          aria-label="Scroll products right"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-secondary hover:text-secondary"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="no-scrollbar -mx-1 overflow-x-auto pb-2 md:overflow-visible md:pb-0">
        <div className={`flex snap-x snap-mandatory gap-3 sm:gap-5 md:grid md:min-w-0 md:grid-cols-3 ${colsClass}`}>
          {products.map((product) => (
            <div key={product.id} data-product-card-wrapper className="min-w-[220px] snap-start md:min-w-0">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
