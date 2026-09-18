import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Package,
  MapPin,
  LogOut,
  Save,
  CheckCircle2,
  ShoppingBag,
  ShieldCheck,
  Heart,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useWishlist } from '../context/WishlistContext';
import useCart from '../hooks/useCart';
import { formatPrice, handleImgError } from '../utils/helpers';
import Button from '../components/common/Button';
import { StatusBadge, inputCls, labelCls } from '../components/admin/AdminForm';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'address', label: 'Address', icon: MapPin },
];

export default function Account() {
  const { user, isLoggedIn, logout, updateProfile } = useAuth();
  const { orders } = useAdmin();
  const { items: wishlistItems, removeItem, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile');
  const [saved, setSaved] = useState(false);

  const myOrders = useMemo(() => {
    if (!user?.email) return [];

    const currentEmail = user.email.trim().toLowerCase();
    return orders.filter((o) => {
      const orderEmail = (o.email || '').trim().toLowerCase();
      return orderEmail === currentEmail;
    });
  }, [orders, user]);

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const handleProfileSave = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    updateProfile({ name: form.name.value, phone: form.phone.value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAddressSave = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    updateProfile({
      address: form.address.value,
      city: form.city.value,
      pin: form.pin.value,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-8xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="h-fit rounded-xl bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-slate-100 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
              {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-primary">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">
                {user.provider === 'google' ? (
                  <>
                    <ShieldCheck size={10} /> Google Account
                  </>
                ) : (
                  'Email Account'
                )}
              </span>
            </div>
          </div>
          <nav className="p-2" aria-label="Account">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  tab === id ? 'bg-secondary/10 text-secondary' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={logout}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Logout
            </button>
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {saved && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> Saved successfully!
            </p>
          )}

          {tab === 'profile' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <h2 className="text-base font-bold text-primary">Profile Information</h2>
              <form onSubmit={handleProfileSave} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ac-name" className={labelCls}>Full Name</label>
                  <input id="ac-name" name="name" defaultValue={user.name} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ac-phone" className={labelCls}>Mobile Number</label>
                  <input id="ac-phone" name="phone" type="tel" defaultValue={user.phone} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ac-email" className={labelCls}>Email (cannot be changed)</label>
                  <input id="ac-email" value={user.email} disabled className={`${inputCls} cursor-not-allowed opacity-60`} />
                </div>
                <div>
                  <span className={labelCls}>Member Since</span>
                  <p className="py-2.5 text-sm font-medium text-slate-600">{user.joined}</p>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="primary">
                    <Save size={16} /> Save Profile
                  </Button>
                </div>
              </form>
            </section>
          )}

          {tab === 'orders' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <h2 className="text-base font-bold text-primary">My Orders ({myOrders.length})</h2>
              {myOrders.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
                  <ShoppingBag size={44} className="text-slate-300" />
                  <p className="text-sm text-slate-500">You have not placed any orders yet.</p>
                  <Button to="/products" variant="primary" size="sm">Start Shopping</Button>
                </div>
              ) : (
                <ul className="mt-4 space-y-4">
                  {myOrders.map((o) => (
                    <li key={o.id} className="rounded-lg border border-slate-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-primary">#{o.id}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-500">
                        {o.items?.map((i, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span className="truncate">{i.name} × {i.qty}</span>
                            <span className="font-medium text-slate-600">{formatPrice(i.price * i.qty)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-between border-t border-slate-100 pt-2.5 text-sm">
                        <span className="text-slate-500">{o.date}</span>
                        <span className="font-bold text-primary">Total: {formatPrice(o.total)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'wishlist' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-primary">My Wishlist ({wishlistItems.length})</h2>
                {wishlistItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearWishlist}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Clear Wishlist
                  </button>
                )}
              </div>

              {wishlistItems.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
                  <Heart size={44} className="text-slate-300" />
                  <p className="text-sm text-slate-500">No products saved in your wishlist yet.</p>
                  <Button to="/products" variant="primary" size="sm">Browse Products</Button>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {wishlistItems.map((product) => (
                    <article key={product.id} className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="relative">
                        <Link to={`/product/${product.id}`}> 
                          <img
                            src={product.images?.[0] || product.image}
                            alt={product.name}
                            onError={handleImgError}
                            className="aspect-[4/3] w-full object-cover"
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
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => addItem(product, 1)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-secondary"
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
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'address' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <h2 className="text-base font-bold text-primary">Saved Delivery Address</h2>
              <form onSubmit={handleAddressSave} className="mt-5 grid gap-4">
                <div>
                  <label htmlFor="ac-address" className={labelCls}>Address</label>
                  <textarea id="ac-address" name="address" rows="2" defaultValue={user.address} className={inputCls} placeholder="Street, building, landmark" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ac-city" className={labelCls}>City</label>
                    <input id="ac-city" name="city" defaultValue={user.city} className={inputCls} placeholder="City" />
                  </div>
                  <div>
                    <label htmlFor="ac-pin" className={labelCls}>PIN Code</label>
                    <input id="ac-pin" name="pin" pattern="[0-9]{6}" defaultValue={user.pin} className={inputCls} placeholder="560001" />
                  </div>
                </div>
                <div>
                  <Button type="submit" variant="primary">
                    <Save size={16} /> Save Address
                  </Button>
                </div>
              </form>
              <p className="mt-4 text-xs text-slate-400">
                This address is auto-filled at checkout.
              </p>
            </section>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            Need help? <Link to="/contact" className="font-semibold text-secondary hover:underline">Contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
