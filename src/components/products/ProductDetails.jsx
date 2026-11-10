import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import useCart from '../../hooks/useCart';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { apiRequest } from '../../utils/api';
import Button from '../common/Button';
import ProductGrid from './ProductGrid';
import SectionHeader from '../common/SectionHeader';
import {
  calcDiscount,
  FALLBACK_IMAGE,
  formatPrice,
  handleImgError,
  productEnquiryLink,
} from '../../utils/helpers';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '../../hooks/useCart';

const TABS = ['Description', 'Specifications', 'Shipping', 'Warranty', 'Reviews'];

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
  const { isAdmin, hasPermission } = useAdmin();
  const { user } = useAuth();
  const { toggleItem, isWishlisted } = useWishlist();
  const navigate = useNavigate();
  const tabPrefix = useId();
  const tabRefs = useRef({});
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('Description');
  const [reviews, setReviews] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [yourReview, setYourReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [cartError, setCartError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const wishlisted = isWishlisted(product.id);
  const canEditProduct = isAdmin && hasPermission('products');
  const reviewAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  useEffect(() => {
    let active = true;
    apiRequest('product-reviews', { query: { product_id: product.id } })
      .then((result) => {
        if (!active) return;
        setReviews(result.reviews);
        setCanReview(result.canReview);
        setYourReview(result.yourReview);
        if (result.yourReview) {
          setReviewRating(result.yourReview.rating);
          setReviewComment(result.yourReview.comment);
        }
      })
      .catch((error) => {
        if (active) setReviewError(error.message);
      });
    return () => {
      active = false;
    };
  }, [product.id, user?.email]);

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewLoading(true);
    setReviewError('');
    setReviewMessage('');
    try {
      await apiRequest('product-review', {
        method: 'POST',
        body: { productId: product.id, rating: reviewRating, comment: reviewComment },
      });
      const result = await apiRequest('product-reviews', { query: { product_id: product.id } });
      setReviews(result.reviews);
      setCanReview(result.canReview);
      setYourReview(result.yourReview);
      setReviewMessage('Your verified purchase review has been published.');
    } catch (error) {
      setReviewError(error.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const galleryImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image
      ? [product.image]
      : [];

  const discount = calcDiscount(product.price, product.oldPrice);
  const stockStatus = String(product.stock || '').trim().toLowerCase();
  const outOfStock = stockStatus === 'out of stock' ||
    (product.stockQuantity != null && Number(product.stockQuantity) <= 0) ||
    (stockStatus === 'limited stock' &&
      (!Number.isInteger(Number(product.stockQuantity)) || Number(product.stockQuantity) < 1));
  const maxPurchasable = product.stockQuantity == null
    ? 10
    : Math.max(0, Math.min(10, Number(product.stockQuantity) || 0));
  const quantityLimitReached = maxPurchasable > 0 && qty >= maxPurchasable;
  const highlights = [
    product.specs.processor,
    product.specs.ram,
    product.specs.storage,
    product.specs.display,
  ];

  const handleBuyNow = () => {
    if (addItem(product, qty)) navigate('/checkout');
    else setCartError(`Only ${maxPurchasable} ${maxPurchasable === 1 ? 'unit' : 'units'} available.`);
  };

  const showPrevImage = () => {
    setActiveImage((current) => (current === 0 ? galleryImages.length - 1 : current - 1));
  };

  const showNextImage = () => {
    setActiveImage((current) => (current === galleryImages.length - 1 ? 0 : current + 1));
  };
  const tabKeyDown = (event, currentIndex) => {
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    else return;
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  const tabDomId = (value) => `${tabPrefix}-${value.toLowerCase()}`;

  return (
    <div className="animate-fade-up">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-card">
            <div className="overflow-hidden rounded-xl bg-white">
              <img
                src={galleryImages[activeImage] || product.image || FALLBACK_IMAGE}
                alt={`${product.name} - image ${activeImage + 1}`}
                onError={handleImgError}
                className="aspect-[4/3] w-full rounded-xl bg-white object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {String(galleryImages[activeImage] || product.image || '').includes('images.unsplash.com') && (
                <span className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow">
                  Illustrative image
                </span>
              )}
            </div>

            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevImage}
                  aria-label="View previous image"
                  className="absolute left-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-lg transition hover:bg-white hover:text-secondary"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="View next image"
                  className="absolute right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-lg transition hover:bg-white hover:text-secondary"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-3">
            {galleryImages.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`View image ${i + 1}`}
                aria-pressed={activeImage === i}
                className={`overflow-hidden rounded-xl border bg-white p-1 shadow-sm transition ${
                  activeImage === i
                    ? 'border-secondary ring-2 ring-secondary/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  onError={handleImgError}
                  className="aspect-[4/3] w-full rounded-lg bg-white object-contain"
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
            <div className="flex items-center gap-2">
              {canEditProduct && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/admin/products', { state: { editProductId: product.id } })}
                >
                  <Pencil size={14} />
                  Edit Product
                </Button>
              )}
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
          </div>

          <h1 className="mt-3 text-2xl font-extrabold text-primary sm:text-3xl">
            {product.name}
          </h1>
          {(product.sku || product.productCode) && (
            <p className="mt-1 text-xs font-medium text-slate-500">SKU: {product.sku || product.productCode}</p>
          )}

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            {reviews.length > 0 ? (
              <>
                <Stars value={reviewAverage} />
                <span className="font-semibold text-primary">{reviewAverage.toFixed(1)}</span>
                <span>({reviews.length} verified {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </>
            ) : <span>No verified reviews yet</span>}
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
              {product.stock === 'Limited Stock' && Number.isInteger(Number(product.stockQuantity))
                ? `${product.stock} · ${product.stockQuantity} available`
                : product.stock}
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
                  onClick={() => setQty((q) => Math.min(maxPurchasable || 10, q + 1))}
                  aria-label="Increase quantity"
                  className="p-2.5 text-slate-600 transition hover:text-secondary disabled:opacity-40"
                  disabled={qty >= Math.max(1, maxPurchasable)}
                >
                  <Plus size={16} />
                </button>
              </div>
              {quantityLimitReached && <p role="status" className="w-full text-xs font-medium text-amber-700">Only {maxPurchasable} {maxPurchasable === 1 ? 'unit' : 'units'} available.</p>}
              <button
                type="button"
                onClick={() => {
                  if (!addItem(product, qty)) setCartError(`Only ${maxPurchasable} ${maxPurchasable === 1 ? 'unit' : 'units'} available.`);
                  else setCartError('');
                }}
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
                Add and go to checkout
              </button>
            </div>
            {cartError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{cartError}</p>}
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
                Free delivery on orders of {formatPrice(FREE_DELIVERY_THRESHOLD)} or more
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
        <div role="tablist" aria-label="Product information" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
          {TABS.map((t, tabIndex) => (
            <button
              key={t}
              ref={(element) => { tabRefs.current[t] = element; }}
              type="button"
              onClick={() => setTab(t)}
              onKeyDown={(event) => tabKeyDown(event, tabIndex)}
              id={tabDomId(t)}
              aria-controls={`${tabDomId(t)}-panel`}
              aria-selected={tab === t}
              role="tab"
              tabIndex={tab === t ? 0 : -1}
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
        {TABS.filter((panelTab) => panelTab !== tab).map((panelTab) => (
          <div
            key={panelTab}
            id={`${tabDomId(panelTab)}-panel`}
            role="tabpanel"
            aria-labelledby={tabDomId(panelTab)}
            hidden
          />
        ))}
        <div
          id={`${tabDomId(tab)}-panel`}
          className="p-5 sm:p-6"
          role="tabpanel"
          aria-labelledby={tabDomId(tab)}
          tabIndex={0}
        >
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
                Delivery is {formatPrice(DELIVERY_FEE)} below {formatPrice(FREE_DELIVERY_THRESHOLD)}; orders at or above that amount ship free.
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
            <div className="max-w-3xl space-y-6">
              {user ? canReview ? (
                <form onSubmit={submitReview} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-bold text-primary">{yourReview ? 'Update your review' : 'Review this product'}</h2>
                  <p className="mt-1 text-xs text-slate-500">Reviews are available to signed-in customers with a delivered order for this product.</p>
                  <label className="mt-4 block text-xs font-semibold text-slate-600" htmlFor="product-review-rating">Rating</label>
                  <select
                    id="product-review-rating"
                    value={reviewRating}
                    onChange={(event) => setReviewRating(Number(event.target.value))}
                    className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} out of 5</option>)}
                  </select>
                  <label className="mt-3 block text-xs font-semibold text-slate-600" htmlFor="product-review-comment">Your experience</label>
                  <textarea
                    id="product-review-comment"
                    required
                    maxLength={1000}
                    rows={4}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  {reviewError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{reviewError}</p>}
                  {reviewMessage && <p role="status" className="mt-2 text-sm font-medium text-emerald-700">{reviewMessage}</p>}
                  <button type="submit" disabled={reviewLoading} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {reviewLoading ? 'Publishing...' : yourReview ? 'Update review' : 'Publish review'}
                  </button>
                </form>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  {reviewError || (user
                    ? 'A review can be submitted after your order for this product is marked delivered.'
                    : <> <Link to="/login" className="font-semibold text-secondary hover:underline">Sign in</Link> to leave a review after purchasing and receiving this product.</>)}
                </p>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  <Link to="/login" className="font-semibold text-secondary hover:underline">Sign in</Link> to leave a review after purchasing and receiving this product.
                </p>
              )}
              {reviews.length ? (
                <ul className="space-y-4">
                  {reviews.map((review) => (
                    <li key={`${review.name}-${review.date}`} className="rounded-lg border border-slate-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-primary">{review.name}</span>
                        <span className="text-xs text-slate-400">{review.date}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={review.rating} size={14} />
                        <span className="text-[11px] font-semibold text-emerald-700">Verified purchase</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{review.comment}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No verified purchase reviews yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-12">
          <SectionHeader title="Related Products" actionLabel="View All" actionTo={`/products?${new URLSearchParams({ category: product.category })}`} />
          <ProductGrid products={related} />
        </div>
      )}
    </div>
  );
}
