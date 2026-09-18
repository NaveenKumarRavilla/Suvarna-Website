import { useParams, Link } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import ProductDetails from '../components/products/ProductDetails';
import Button from '../components/common/Button';

export default function ProductDetailsPage() {
  const { products } = useAdmin();
  const { id } = useParams();
  const product = products.find((p) => String(p.id) === id);

  if (!product) {
    return (
      <div className="mx-auto flex max-w-8xl flex-col items-center gap-4 px-4 py-24 text-center">
        <PackageX size={56} className="text-slate-300" />
        <h1 className="text-2xl font-bold text-primary">Product not found</h1>
        <p className="text-sm text-slate-500">
          The product you are looking for does not exist or has been removed.
        </p>
        <Button to="/products" variant="primary">
          Browse Products
        </Button>
      </div>
    );
  }

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-8xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="transition hover:text-secondary">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              to={`/products?category=${product.category}`}
              className="capitalize transition hover:text-secondary"
            >
              {product.category}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-primary" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>
      <ProductDetails product={product} related={related} />
    </div>
  );
}
