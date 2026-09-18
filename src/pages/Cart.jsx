import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, ShieldCheck } from 'lucide-react';
import useCart from '../hooks/useCart';
import { formatPrice, handleImgError } from '../utils/helpers';
import Button from '../components/common/Button';

export default function Cart() {
  const { items, updateQty, removeItem, subtotal, savings, delivery, total } = useCart();

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-8xl flex-col items-center gap-4 px-4 py-24 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card">
          <ShoppingCart size={36} className="text-slate-300" />
        </span>
        <h1 className="text-2xl font-bold text-primary">Your cart is empty</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Looks like you have not added anything yet. Explore our products and find
          something you like.
        </p>
        <Button to="/products" variant="primary" size="lg">
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-8xl px-4 py-8">
      <h1 className="mb-6 text-xl font-extrabold text-primary sm:text-2xl">
        Shopping Cart{' '}
        <span className="text-base font-medium text-slate-400">
          ({items.length} item{items.length === 1 ? '' : 's'})
        </span>
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card sm:flex-row sm:items-center"
            >
              <Link to={`/product/${item.id}`} className="shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  onError={handleImgError}
                  className="h-24 w-28 rounded-lg object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  {item.brand}
                </span>
                <h3 className="truncate text-sm font-semibold text-primary">
                  <Link to={`/product/${item.id}`} className="hover:text-secondary">
                    {item.name}
                  </Link>
                </h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base font-bold text-primary">
                    {formatPrice(item.price)}
                  </span>
                  {item.oldPrice > item.price && (
                    <span className="text-xs text-slate-400 line-through">
                      {formatPrice(item.oldPrice)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="flex items-center rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, item.qty - 1)}
                    aria-label={`Decrease quantity of ${item.name}`}
                    className="p-2 text-slate-600 transition hover:text-secondary"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-9 text-center text-sm font-bold" aria-live="polite">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, item.qty + 1)}
                    aria-label={`Increase quantity of ${item.name}`}
                    className="p-2 text-slate-600 transition hover:text-secondary"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-primary">
                    {formatPrice(item.price * item.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <aside className="h-fit rounded-xl bg-white p-6 shadow-card lg:sticky lg:top-24">
          <h2 className="text-base font-bold uppercase tracking-wider text-primary">
            Order Summary
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-semibold text-primary">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-semibold text-emerald-600">
                - {formatPrice(savings)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Delivery</dt>
              <dd className="font-semibold text-primary">
                {delivery === 0 ? (
                  <span className="text-emerald-600">FREE</span>
                ) : (
                  formatPrice(delivery)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base">
              <dt className="font-bold text-primary">Total</dt>
              <dd className="font-extrabold text-primary">{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-secondary" />
            Prices include GST. Secure checkout.
          </p>
          <div className="mt-5 space-y-2.5">
            <Button to="/checkout" variant="accent" size="lg" className="w-full">
              Proceed to Checkout
            </Button>
            <Button to="/products" variant="outline" size="md" className="w-full">
              Continue Shopping
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
