import { useAdmin } from '../../context/AdminContext';
import SectionHeader from '../common/SectionHeader';
import ProductGrid from '../products/ProductGrid';

export default function FeaturedProducts() {
  const { products } = useAdmin();
  const featured = products.filter((p) => p.featured).slice(0, 8);

  return (
    <section aria-labelledby="featured-products" className="mx-auto max-w-8xl px-4 py-10">
      <SectionHeader
        title="Featured Products"
        subtitle="Handpicked best sellers from top brands"
        actionLabel="View All"
        actionTo="/products"
      />
      <div id="featured-products">
        <ProductGrid products={featured} />
      </div>
    </section>
  );
}
