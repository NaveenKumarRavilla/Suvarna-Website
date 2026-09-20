import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, ShoppingCart, Zap } from 'lucide-react';
import useCart from '../../hooks/useCart';
import { useWishlist } from '../../context/WishlistContext';
import {
  calcDiscount,
  formatPrice,
  handleImgError,
  productEnquiryLink,
} from '../../utils/helpers';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const navigate = useNavigate();
  const wishlisted = isWishlisted(product.id);

  const discount = calcDiscount(product.price, product.oldPrice);
  const outOfStock = product.stock === 'Out of Stock';

  const handleAddToCart = () => addItem(product, 1);
  const handleBuyNow = () => {
    addItem(product, 1);
    navigate('/checkout');
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-card-hover">
      {/* Image */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-slate-50 p-2">
        <Link to={`/product/${product.id}`} aria-label={`View ${product.name}`} className="block overflow-hidden rounded-xl bg-white">
          <img
            src={product.images?.[0] || product.image}
            alt={product.name}
            loading="lazy"
            onError={handleImgError}
            className="aspect-[4/3] w-full rounded-xl bg-white object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-navy-900 shadow">
            {discount}% OFF
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleItem(product)}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-110"
        >
          <Heart
            size={16}
            className={wishlisted ? 'fill-red-500 text-red-500' : 'text-slate-500'}
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <span className="w-fit rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
          {product.brand}
        </span>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-primary">
          <Link to={`/product/${product.id}`} className="transition hover:text-secondary">
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs text-slate-500">
          {product.specs.processor}
        </p>
        <p className="line-clamp-1 text-xs text-slate-500">
          {product.specs.ram} &bull; {product.specs.storage} &bull; {product.specs.display}
        </p>
        <p
          className={`flex items-center gap-1.5 text-xs font-medium ${
            outOfStock
              ? 'text-red-600'
              : product.stock === 'Limited Stock'
                ? 'text-amber-600'
                : 'text-emerald-600'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
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

        {/* Price */}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-extrabold text-primary">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice > product.price && (
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-primary px-2 py-2 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
          >
            <ShoppingCart size={13} />
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={outOfStock}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-[11px] font-bold text-navy-900 transition hover:bg-accent-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
          >
            <Zap size={13} />
            Buy Now
          </button>
          <a
            href={productEnquiryLink(product)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Enquire about ${product.name} on WhatsApp`}
            className="flex items-center justify-center rounded-lg bg-[#25D366] px-2.5 text-white transition hover:bg-[#1DA851]"
          >
            <MessageCircle size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}
