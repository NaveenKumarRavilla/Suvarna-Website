import { useState } from 'react';
import { Heart, ShoppingCart, Trash2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import useCart from '../hooks/useCart';
import { useWishlist } from '../context/WishlistContext';
import { useAdmin } from '../context/AdminContext';
import { FALLBACK_IMAGE, formatPrice, handleImgError } from '../utils/helpers';

const normalizeProductId = (id) => String(id ?? '').trim();
const productIdentity = (product) => [product.name, product.brand, product.category]
  .map((value) => String(value || '').trim().toLowerCase())
  .join('|');
const isAvailable = (product) => ['in stock', 'limited stock'].includes(String(product?.stock || '').toLowerCase());
const getAvailableCurrentProduct = (savedProduct, productsById) => {
  const currentProduct = productsById.get(normalizeProductId(savedProduct.id));
  if (!currentProduct || !isAvailable(currentProduct) || productIdentity(savedProduct) !== productIdentity(currentProduct)) return null;
  return currentProduct;
};

export default function WishlistPage() {
  const { items, removeItem, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const { storefrontProducts } = useAdmin();
  const [cartNotice, setCartNotice] = useState('');
  const productsById = new Map(storefrontProducts.map((product) => [normalizeProductId(product.id), product]));

  const addAllToCart = () => {
    let added = 0;
    items.forEach((savedProduct) => {
      const currentProduct = getAvailableCurrentProduct(savedProduct, productsById);
      if (!currentProduct) return;
      addItem(currentProduct, 1);
      removeItem(savedProduct.id);
      added += 1;
    });
    const remaining = items.length - added;
    setCartNotice(remaining
      ? `${added} item(s) added. ${remaining} unavailable or changed item(s) remain in your wishlist.`
      : 'All available wishlist items were added to your cart.');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-secondary">Saved List</span>
          <h1 className="mt-1 text-2xl font-extrabold text-primary sm:text-3xl">My Wishlist</h1>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addAllToCart}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-secondary"
            >
              <Plus size={15} /> Add All to Cart
            </button>
            <button
              type="button"
              onClick={clearWishlist}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear Wishlist
            </button>
          </div>
        )}
      </div>

      {cartNotice && <p role="status" className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{cartNotice}</p>}

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-card">
          <Heart size={44} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-lg font-bold text-primary">Your wishlist is empty</h2>
          <p className="mt-2 text-sm text-slate-500">Select products from the catalog to save them here.</p>
          <Link
            to="/products"
            className="mt-5 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-secondary"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((product) => {
            const availableProduct = getAvailableCurrentProduct(product, productsById);
            return (
            <article key={product.id} className="overflow-hidden rounded-xl bg-white shadow-card">
              <div className="relative">
                <Link to={`/product/${product.id}`}> 
                  <img
                    src={product.images?.[0] || product.image || FALLBACK_IMAGE}
                    alt={product.name}
                    onError={handleImgError}
                    className="aspect-[4/3] w-full bg-white object-contain p-2"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow transition hover:scale-110"
                  aria-label={`Remove ${product.name} from wishlist`}
                >
                  <Heart size={16} className="fill-red-500 text-red-500" />
                </button>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">{product.brand}</span>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-primary">{product.name}</h3>
                <p className="mt-1 text-sm font-extrabold text-primary">{formatPrice(product.price)}</p>
                {!availableProduct && <p className="mt-2 text-xs font-medium text-amber-700">This saved item is unavailable or has changed in the catalogue. Review it before adding.</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!availableProduct) return;
                      addItem(availableProduct, 1);
                      removeItem(product.id);
                    }}
                    disabled={!availableProduct}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShoppingCart size={14} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(product.id)}
                    className="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-slate-500 transition hover:bg-slate-50 hover:text-red-500"
                    aria-label={`Remove ${product.name} from wishlist`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
