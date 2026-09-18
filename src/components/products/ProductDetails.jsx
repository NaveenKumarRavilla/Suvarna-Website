import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
  Check,
} from 'lucide-react';
import useCart from '../../hooks/useCart';
import { useWishlist } from '../../context/WishlistContext';
import ProductGrid from './ProductGrid';
import SectionHeader from '../common/SectionHeader';
import {
  calcDiscount,
  formatPrice,
  handleImgError,
  productEnquiryLink,
} from '../../utils/helpers';
import { FREE_DELIVERY_THRESHOLD } from '../../hooks/useCart';

const TABS = ['Description', 'Specifications', 'Shipping', 'Warranty', 'Reviews'];

const mockReviews = [
  {
    name: 'Rahul M.',
    rating: 5,
    date: 'August 2026',
    comment: 'Excellent product, genuine and delivered quickly. Highly recommended seller.',
  },
  {
    name: 'Priya S.',
    rating: 4,
    date: 'July 2026',
    comment: 'Good value for money. The team helped with setup over WhatsApp.',
  },
  {
    name: 'Anand K.',
    rating: 5,
    date: 'June 2026',
    comment: 'Best price in the market and great after-sales support.',
  },
];

function Stars({ value, size = 16 }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={
            s <= Math.round(value) ? 'fill-accent text-accent' : 'text-slate-300'
          }
        />
      ))}
    </span>
  );
}

export default function ProductDetails({ product, related }) {
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const navigate = useNavigate();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('Description');
  const wishlisted = isWishlisted(product.id);

  const galleryImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image
      ? [product.image]
      : [];

  const discount = calcDiscount(product.price, product.oldPrice);
  const outOfStock = product.stock === 'Out of Stock';
  const highlights = [
    product.specs.processor,
    product.specs.ram,
    product.specs.storage,
    product.specs.display,
  ];

  const handleBuyNow = () => {
    addItem(product, qty);
    navigate('/checkout');
  };

  return (
    <div className="animate-fade-up">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="overflow-hidden rounded-xl bg-white shadow-card">
            <img
              src={galleryImages[activeImage] || product.image}
              alt={`${product.name} - image ${activeImage + 1}`}
              onError={handleImgError}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {galleryImages.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`View image ${i + 1}`}
                aria-pressed={activeImage === i}
                className={`overflow-hidden rounded-lg bg-white shadow-sm ring-2 transition ${
                  activeImage === i ? 'ring-secondary' : 'ring-transparent hover:ring-slate-300'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  onError={handleImgError}
                  className="aspect-[4/3] w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <span className="rounded bg-secondary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
              {product.brand}
            </span>
            <button
              type="button"
              onClick={() => toggleItem(product)}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow transition hover:scale-110"
            >
              <Heart
                size={18}
                className={wishlisted ? 'fill-red-500 text-red-500' : 'text-slate-500'}
              />
            </button>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold text-primary sm:text-3xl">
            {product.name}
          </h1>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Stars value={product.rating} />
            <span className="font-semibold text-primary">{product.rating}</span>
            <span>({product.reviews} reviews)</span>
          </div>

          <div className="mt-4 rounded-xl bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-black text-primary">
                {formatPrice(product.price)}
              </span>
              {product.oldPrice > product.price && (
                <>
                  <span className="text-lg text-slate-400 line-through">
                    {formatPrice(product.oldPrice)}
                  </span>
                  <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-navy-900">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>
            {product.oldPrice > product.price && (
              <p className="mt-1 text-sm font-medium text-emerald-600">
                You save {formatPrice(product.oldPrice - product.price)}
              </p>
            )}
            <p
              className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
                outOfStock
                  ? 'text-red-600'
                  : product.stock === 'Limited Stock'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  outOfStock
                    ? 'bg-red-500'
                    : product.stock === 'Limited Stock'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {product.stock}
            </p>

            <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={14} className="shrink-0 text-emerald-500" />
                  {h}
                </li>
              ))}
            </ul>

            {/* Quantity + actions */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="p-2.5 text-slate-600 transition hover:text-secondary disabled:opacity-40"
                  disabled={qty <= 1}
                >
                  <Minus size={16} />
                </button>
                <span className="w-10 text-center text-sm font-bold" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                  aria-label="Increase quantity"
                  className="p-2.5 text-slate-600 transition hover:text-secondary disabled:opacity-40"
                  disabled={qty >= 10}
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => addItem(product, qty)}
                disabled={outOfStock}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart size={16} />
                Add to Cart
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={outOfStock}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-accent-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Zap size={16} />
                Buy Now
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              <a
                href={productEnquiryLink(product)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1DA851]"
              >
                <MessageCircle size={16} />
                WhatsApp Enquiry
              </a>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <Truck size={16} className="text-secondary" />
                Free delivery above {formatPrice(FREE_DELIVERY_THRESHOLD)}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-secondary" />
                {product.warranty}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-10 rounded-xl bg-white shadow-card">
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-selected={tab === t}
              role="tab"
              className={`whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t
                  ? 'border-accent text-secondary'
                  : 'border-transparent text-slate-500 hover:text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-6" role="tabpanel">
          {tab === 'Description' && (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              {product.description}
            </p>
          )}
          {tab === 'Specifications' && (
            <dl className="max-w-2xl divide-y divide-slate-100">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-4 py-2.5 text-sm">
                  <dt className="font-semibold capitalize text-primary">{key}</dt>
                  <dd className="text-slate-600">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === 'Shipping' && (
            <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Orders are dispatched within 24-48 business hours.</li>
              <li>
                Free delivery on orders above {formatPrice(FREE_DELIVERY_THRESHOLD)} across India.
              </li>
              <li>Standard delivery: 3-7 business days depending on location.</li>
              <li>Secure packaging with transit insurance on all electronics.</li>
            </ul>
          )}
          {tab === 'Warranty' && (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              This product is covered by <strong>{product.warranty}</strong>. Suvarna IT
              Enterprises provides complete warranty support including claim assistance,
              authorized service center coordination and genuine spare parts.
            </p>
          )}
          {tab === 'Reviews' && (
            <ul className="max-w-3xl space-y-5">
              {mockReviews.map((r) => (
                <li key={r.name} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-primary">{r.name}</span>
                    <span className="text-xs text-slate-400">{r.date}</span>
                  </div>
                  <div className="mt-1">
                    <Stars value={r.rating} size={14} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-12">
          <SectionHeader title="Related Products" actionLabel="View All" actionTo={`/products?category=${product.category}`} />
          <ProductGrid products={related} />
        </div>
      )}
    </div>
  );
}
