import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Landmark, Banknote, Smartphone } from 'lucide-react';
import useCart from '../hooks/useCart';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/helpers';
import Button from '../components/common/Button';

const paymentMethods = [
  { id: 'upi', label: 'UPI / GPay / PhonePe', icon: Smartphone },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'netbanking', label: 'Net Banking', icon: Landmark },
  { id: 'cod', label: 'Cash on Delivery', icon: Banknote },
];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-secondary focus:bg-white focus:ring-2 focus:ring-secondary/20';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, savings, delivery, total, clearCart } = useCart();
  const { addOrder } = useAdmin();
  const { user, isLoggedIn, updateProfile } = useAuth();
  const [payment, setPayment] = useState('upi');
  const [orderId, setOrderId] = useState(null);

  const placeOrder = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const id = `SIE${Date.now().toString().slice(-8)}`;
    const address = form.querySelector('#co-address')?.value || '';
    const city = form.querySelector('#co-city')?.value || '';
    const pin = form.querySelector('#co-pin')?.value || '';
    addOrder({
      id,
      customer: form.querySelector('#co-name')?.value || 'Guest',
      phone: form.querySelector('#co-phone')?.value || '',
      email: form.querySelector('#co-email')?.value || '',
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
        brand: i.brand,
        category: i.category,
        image: i.image,
        oldPrice: i.oldPrice,
        stock: i.stock,
      })),
      total,
      payment,
      date: new Date().toISOString().slice(0, 10),
    });
    // Save address to profile for returning customers
    if (isLoggedIn) updateProfile({ address, city, pin });
    setOrderId(id);
    clearCart();
    window.scrollTo(0, 0);
  };

  if (orderId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CheckCircle2 size={64} className="text-emerald-500" />
        <h1 className="text-2xl font-extrabold text-primary">Order Placed Successfully!</h1>
        <p className="text-sm text-slate-500">
          Thank you for shopping with Suvarna IT Enterprises. Your order{' '}
          <span className="font-bold text-primary">#{orderId}</span> has been received.
          Our team will contact you shortly to confirm delivery.
        </p>
        <div className="mt-2 flex gap-3">
          <Button to="/products" variant="primary">
            Continue Shopping
          </Button>
          <Button to="/" variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-primary">Nothing to checkout</h1>
        <p className="text-sm text-slate-500">Add some products to your cart first.</p>
        <Button to="/products" variant="primary">
          Browse Products
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-8xl px-4 py-8">
      <h1 className="mb-6 text-xl font-extrabold text-primary sm:text-2xl">Checkout</h1>
      <form onSubmit={placeOrder} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-primary">Contact Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="co-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Full Name *
                </label>
                <input id="co-name" required defaultValue={user?.name || ''} className={inputCls} placeholder="Your full name" />
              </div>
              <div>
                <label htmlFor="co-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email *
                </label>
                <input id="co-email" type="email" required defaultValue={user?.email || ''} className={inputCls} placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="co-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Mobile Number *
                </label>
                <input
                  id="co-phone"
                  type="tel"
                  required
                  pattern="[+0-9\\- ]{10,15}"
                  defaultValue={user?.phone || ''}
                  className={inputCls}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-primary">Delivery Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="co-address" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Address *
                </label>
                <textarea
                  id="co-address"
                  required
                  rows="2"
                  defaultValue={user?.address || ''}
                  className={inputCls}
                  placeholder="Street, building, landmark"
                />
              </div>
              <div>
                <label htmlFor="co-city" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  City *
                </label>
                <input id="co-city" required defaultValue={user?.city || ''} className={inputCls} placeholder="City" />
              </div>
              <div>
                <label htmlFor="co-pin" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  PIN Code *
                </label>
                <input id="co-pin" required pattern="[0-9]{6}" defaultValue={user?.pin || ''} className={inputCls} placeholder="560001" />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-bold text-primary">Payment Method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentMethods.map(({ id, label, icon: Icon }) => (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 text-sm font-medium transition ${
                    payment === id
                      ? 'border-secondary bg-secondary/5 text-primary ring-1 ring-secondary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={id}
                    checked={payment === id}
                    onChange={() => setPayment(id)}
                    className="sr-only"
                  />
                  <Icon size={18} className="text-secondary" />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              This is a demo checkout — no real payment is processed.
            </p>
          </section>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-xl bg-white p-6 shadow-card lg:sticky lg:top-24">
          <h2 className="text-base font-bold uppercase tracking-wider text-primary">
            Order Summary
          </h2>
          <ul className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">
                  {item.name} <span className="text-slate-400">x{item.qty}</span>
                </span>
                <span className="shrink-0 font-semibold text-primary">
                  {formatPrice(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-semibold text-primary">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-semibold text-emerald-600">- {formatPrice(savings)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Delivery</dt>
              <dd className="font-semibold text-primary">
                {delivery === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(delivery)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base">
              <dt className="font-bold text-primary">Total</dt>
              <dd className="font-extrabold text-primary">{formatPrice(total)}</dd>
            </div>
          </dl>
          <Button type="submit" variant="accent" size="lg" className="mt-5 w-full">
            Place Order
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => navigate('/cart')}
          >
            Back to Cart
          </Button>
        </aside>
      </form>
    </div>
  );
}
