import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Check, CheckCircle2, ChevronRight, CreditCard, Landmark, LockKeyhole, MapPin, PackageCheck, Pencil, Plus, Smartphone, X } from 'lucide-react';
import useCart from '../hooks/useCart';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/helpers';
import Button from '../components/common/Button';

const PENDING_ORDER_REQUEST_KEY = 'suvarna_pending_order_request';
const createOrderRequestKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `sie-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const hashOrderFingerprint = async (fingerprint) => {
  if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getOrderRequestKey = async (fingerprint) => {
  try {
    const fingerprintHash = await hashOrderFingerprint(fingerprint);
    if (!fingerprintHash) return createOrderRequestKey();
    const saved = JSON.parse(sessionStorage.getItem(PENDING_ORDER_REQUEST_KEY) || 'null');
    if (saved?.fingerprintHash === fingerprintHash && typeof saved.key === 'string') return saved.key;
    const key = createOrderRequestKey();
    sessionStorage.setItem(PENDING_ORDER_REQUEST_KEY, JSON.stringify({ fingerprintHash, key }));
    return key;
  } catch {
    return createOrderRequestKey();
  }
};

const clearOrderRequestKey = (key) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_ORDER_REQUEST_KEY) || 'null');
    if (saved?.key === key) sessionStorage.removeItem(PENDING_ORDER_REQUEST_KEY);
  } catch {
    /* session storage unavailable */
  }
};

const paymentMethods = [
  { id: 'upi', label: 'UPI', note: 'Pay by any UPI app', icon: Smartphone },
  { id: 'card', label: 'Credit / Debit / ATM Card', note: 'Add and secure your card', icon: CreditCard },
  { id: 'netbanking', label: 'Net Banking', note: 'Pay securely with your bank', icon: Landmark },
  { id: 'cod', label: 'Cash on Delivery', note: 'Pay at the time of delivery', icon: Banknote },
];
const emptyAddress = { address: '', city: '', pin: '' };
const inputCls = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/15';
const savedFor = (user) => Array.isArray(user?.addresses) && user.addresses.length ? user.addresses : (user?.address || user?.city || user?.pin ? [{ id: 'legacy-address', label: 'Saved address', address: user.address || '', city: user.city || '', pin: user.pin || '' }] : []);

function Progress({ page }) {
  const labels = ['Address', 'Order Summary', 'Payment'];
  const active = page === 'payment' ? 2 : 1;
  return <ol className="checkout-progress mx-auto grid w-full max-w-lg grid-cols-3 items-center py-3">{labels.map((label, index) => <li key={label} className="relative flex min-w-0 flex-col items-center gap-1.5"><span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${index < active ? 'border-secondary bg-white text-secondary' : index === active ? 'border-secondary bg-secondary text-white' : 'border-slate-300 bg-white text-slate-400'}`}>{index < active ? <Check size={13} strokeWidth={3} /> : index + 1}</span><span className={`text-center text-[11px] font-semibold leading-4 ${index === active ? 'text-primary' : 'text-slate-400'}`}>{label}</span></li>)}</ol>;
}

function PriceDetails({ subtotal, savings, delivery, total, action }) {
  return <aside className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-200"><h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary">Price Details</h2><div className="space-y-3 px-4 py-4 text-sm"><div className="flex justify-between"><span className="text-slate-600">MRP (incl. of all taxes)</span><b className="text-primary">{formatPrice(subtotal + savings)}</b></div><div className="flex justify-between border-b border-dashed border-slate-200 pb-3"><span className="text-slate-600">Delivery fees</span><b className={delivery ? 'text-primary' : 'text-emerald-600'}>{delivery ? formatPrice(delivery) : 'FREE'}</b></div><div className="flex justify-between border-b border-slate-200 pb-3"><span className="text-slate-600">Discounts</span><b className="text-emerald-600">− {formatPrice(savings)}</b></div><div className="flex justify-between pt-1"><span className="font-semibold text-primary">Total Amount</span><b className="text-base text-primary">{formatPrice(total)}</b></div>{savings > 0 && <div className="rounded-md bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700">You’ll save {formatPrice(savings)} on this order!</div>}</div>{action && <div className="border-t border-slate-100 p-2">{action}</div>}</aside>;
}

export default function Checkout() {
  const navigate = useNavigate();
  const {
    items,
    subtotal,
    savings,
    delivery,
    total,
    clearCart,
    acknowledgePriceChanges,
  } = useCart();
  const { addOrder, refreshStorefrontData } = useAdmin();
  const { user, isLoggedIn, updateProfile } = useAuth();
  const initialAddresses = savedFor(user);
  const [page, setPage] = useState('summary');
  const [addressPanel, setAddressPanel] = useState(() => initialAddresses.length === 0);
  const [payment, setPayment] = useState('cod');
  const [orderId, setOrderId] = useState(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState(initialAddresses[0]?.id || 'new');
  const [address, setAddress] = useState(() => initialAddresses[0] ? { address: initialAddresses[0].address, city: initialAddresses[0].city, pin: initialAddresses[0].pin } : emptyAddress);
  const [contact, setContact] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [saveForLater, setSaveForLater] = useState(true);
  const [customerError, setCustomerError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const placingOrderRef = useRef(false);
  const orderRequestRef = useRef({ fingerprint: '', key: '' });
  const hasUnreviewedPriceChanges = items.some((item) => item.priceChanged);
  const hasUnavailableItems = items.some((item) => item.unavailable);
  const selectedPayment = paymentMethods.find((method) => method.id === payment);
  const PaymentIcon = selectedPayment.icon;
  const activeAddress = addresses.find((item) => item.id === selectedId);

  const chooseAddress = (item) => { setSelectedId(item.id); setAddress({ address: item.address || '', city: item.city || '', pin: item.pin || '' }); };
  const addNew = () => { setSelectedId('new'); setAddress(emptyAddress); };
  const saveAddress = async () => {
    const invalid = ['delivery-name', 'delivery-phone', 'delivery-address', 'delivery-city', 'delivery-pin'].find((id) => !document.getElementById(id)?.reportValidity());
    if (invalid) return;
    const exists = addresses.find((item) => item.address === address.address && item.city === address.city && item.pin === address.pin);
    const next = exists ? addresses : [...addresses, { id: `address-${Date.now()}`, label: contact.name || `Address ${addresses.length + 1}`, ...address }];
    if (saveForLater && !exists && isLoggedIn) {
      const result = await updateProfile({ address: address.address, city: address.city, pin: address.pin, addresses: next });
      if (!result.ok) {
        setCustomerError(result.error);
        return;
      }
      setAddresses(next);
      setSelectedId(next.at(-1).id);
      setCustomerError('');
    }
    setAddressPanel(false);
  };
  const placeOrder = async () => {
    if (hasUnreviewedPriceChanges) {
      setCustomerError('Review the updated product prices before placing your order.');
      return;
    }
    if (hasUnavailableItems) {
      setCustomerError('Remove unavailable products from your cart before placing your order.');
      return;
    }
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;
    setPlacingOrder(true);
    setCustomerError('');
    try {
      if (isLoggedIn && saveForLater) {
        const result = await updateProfile({ address: address.address, city: address.city, pin: address.pin, addresses });
        if (!result.ok) {
          setCustomerError(result.error);
          return;
        }
      }
      const order = {
        customer: contact.name || 'Guest',
        phone: contact.phone,
        email: contact.email,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          brand: item.brand,
          category: item.category,
          image: item.image,
          oldPrice: item.oldPrice,
          stock: item.stock,
        })),
        total,
        payment,
        shippingAddress: address,
        date: new Date().toISOString().slice(0, 10),
      };
      const fingerprint = JSON.stringify({
        customer: order.customer,
        phone: order.phone,
        email: order.email,
        items: order.items.map(({ id, qty, price }) => ({ id, qty, price })),
        total: order.total,
        payment: order.payment,
        shippingAddress: order.shippingAddress,
      });
      if (orderRequestRef.current.fingerprint !== fingerprint) {
        orderRequestRef.current = {
          fingerprint,
          key: await getOrderRequestKey(fingerprint),
        };
      }
      const idempotencyKey = orderRequestRef.current.key;
      const result = await addOrder({ ...order, idempotencyKey });
      if (!result.ok) {
        if (result.status === 409) {
          try {
            await refreshStorefrontData();
          } catch (error) {
            console.error('Could not refresh product prices after checkout validation failed.', error);
          }
        }
        setCustomerError(result.error);
        return;
      }
      clearOrderRequestKey(idempotencyKey);
      orderRequestRef.current = { fingerprint: '', key: '' };
      setOrderTotal(result.order.total);
      setOrderId(result.order.id);
      clearCart();
      window.scrollTo(0, 0);
    } catch (error) {
      setCustomerError(error.message || 'Could not place your order. Please try again.');
    } finally {
      placingOrderRef.current = false;
      setPlacingOrder(false);
    }
  };

  if (orderId) return <div className="min-h-[70vh] bg-slate-100 px-4 py-10"><div className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white text-center shadow-card"><div className="px-6 py-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-secondary"><CheckCircle2 size={34} /></span><h1 className="mt-4 text-2xl font-extrabold text-primary">Order Successfully Placed!</h1><p className="mt-2 text-sm text-slate-500">Your order number is <b className="text-secondary">#{orderId}</b>.</p></div><div className="divide-y divide-slate-100 border-y text-left text-sm"><p className="flex justify-between px-6 py-4"><span className="text-slate-500">Order Status</span><b className="text-secondary">Awaiting confirmation</b></p><p className="flex justify-between px-6 py-4"><span className="text-slate-500">Order Total</span><b>{formatPrice(orderTotal)}</b></p><p className="flex justify-between px-6 py-4"><span className="text-slate-500">Payment Method</span><b>{selectedPayment.label}</b></p></div><div className="p-5"><Button to="/products" variant="primary">Continue Shopping</Button></div></div></div>;
  if (!items.length) return <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center"><PackageCheck size={46} className="text-secondary" /><h1 className="text-2xl font-bold text-primary">Nothing to checkout</h1><p className="text-sm text-slate-500">Add some products to your cart first.</p><Button to="/products" variant="primary">Browse Products</Button></div>;

  return <main className="min-h-screen bg-slate-100 pb-8"><div className="mx-auto max-w-7xl px-3 sm:px-5"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5"><button type="button" onClick={() => navigate('/cart')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-secondary"><ArrowLeft size={15} /> Cart</button><Progress page={page} /><span className="hidden items-center gap-1 text-xs font-semibold text-slate-500 sm:flex"><LockKeyhole size={14} /> Secure checkout</span></div>
    {customerError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{customerError}</p>}
    {hasUnreviewedPriceChanges && <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><p className="font-semibold">Product prices changed. Review these updated prices before placing your order:</p><ul className="mt-2 space-y-1">{items.filter((item) => item.priceChanged).map((item) => <li key={item.id}>{item.name}: {formatPrice(item.previousPrice)} → {formatPrice(item.price)}</li>)}</ul><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { acknowledgePriceChanges(); setCustomerError(''); }}>I have reviewed the updated prices</Button></div>}
    {hasUnavailableItems && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">One or more products are no longer available. Remove them from your cart before continuing.</p>}
    {page === 'summary' && <div className="grid gap-4 pt-3 min-[480px]:grid-cols-[minmax(0,1fr)_260px]"><section className="space-y-3"><div className="bg-white px-4 py-4 shadow-sm sm:px-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-primary">Deliver to:</p><p className="mt-2 text-sm font-semibold text-primary">{contact.name || 'Add your delivery address'}</p><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">{address.address ? <>{address.address}, {address.city} {address.pin}</> : 'Select or add an address to continue.'}</p><p className="mt-1 text-sm text-slate-700">{contact.phone}</p></div><button type="button" onClick={() => setAddressPanel(true)} className="shrink-0 rounded border border-slate-200 px-4 py-2 text-xs font-semibold text-secondary hover:border-secondary">{address.address ? 'Change' : 'Add address'}</button></div></div><div className="bg-white shadow-sm"><div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">{items.map((item) => <article key={item.id} className="flex gap-4 px-4 py-4 sm:px-5"><img src={item.image} alt="" className="h-20 w-20 shrink-0 object-contain" /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-primary sm:text-base">{item.name}</h2><p className="mt-1 text-xs text-slate-500">{item.brand} · Qty: {item.qty}</p><p className="mt-3 text-sm font-bold text-primary">{formatPrice(item.price * item.qty)} <span className="ml-1 text-xs font-medium text-slate-400 line-through">{item.oldPrice ? formatPrice(item.oldPrice * item.qty) : ''}</span></p><p className="mt-3 text-xs text-secondary">Delivery will be confirmed after your order.</p></div></article>)}</div></div></section><div className="space-y-3 min-[480px]:sticky min-[480px]:top-3 min-[480px]:h-fit"><PriceDetails subtotal={subtotal} savings={savings} delivery={delivery} total={total} action={<Button type="button" variant="accent" className="w-full justify-center" onClick={() => address.address ? setPage('payment') : setAddressPanel(true)}>Continue</Button>} /><p className="px-2 text-xs leading-relaxed text-slate-500">By continuing, you agree to Suvarna IT Enterprises’ terms and privacy policy.</p></div></div>}
    {page === 'payment' && <div className="checkout-payment-layout grid gap-4 pt-3"><aside className="bg-white p-3 shadow-sm sm:p-4"><h2 className="mb-3 px-1 text-sm font-bold text-primary">Payment method</h2><div className="space-y-2">{paymentMethods.map(({ id, label, note, icon: Icon }) => <button key={id} type="button" disabled={id !== 'cod'} aria-pressed={payment === id} onClick={() => setPayment(id)} className={`flex min-h-[68px] w-full items-center gap-3 rounded-md border p-3 text-left transition ${id === 'cod' ? 'border-secondary bg-secondary/5 ring-1 ring-secondary' : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'}`}><Icon size={20} className="shrink-0 text-primary" /><span className="min-w-0"><b className="block text-sm leading-5 text-primary">{label}</b><small className="mt-0.5 block text-xs leading-4 text-slate-500">{note}</small></span></button>)}</div></aside><section className="min-h-[360px] bg-white p-5 shadow-sm sm:p-6"><div className="mx-auto max-w-lg"><div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary/10 text-secondary"><PaymentIcon size={22} /></div><h2 className="mt-4 text-lg font-bold text-primary">Cash on Delivery</h2><p className="mt-1 text-sm text-slate-500">Pay at the time of delivery.</p><div className="mt-6 rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-primary">Cash payment</p><p className="mt-1">Pay {formatPrice(total)} in cash when your order arrives at the delivery address.</p><p className="mt-2 text-xs text-slate-500">Please keep the amount ready. Delivery fees are included in the total.</p></div></div></section><div className="checkout-payment-price"><PriceDetails subtotal={subtotal} savings={savings} delivery={delivery} total={total} action={<div className="space-y-2"><Button type="button" variant="accent" className="w-full justify-center" onClick={placeOrder} disabled={placingOrder || hasUnreviewedPriceChanges || hasUnavailableItems}>{placingOrder ? 'Placing Order…' : 'Place Order'}</Button><Button type="button" variant="outline" className="w-full justify-center" onClick={() => setPage('summary')}>Order Summary</Button></div>} /></div></div>}
  </div>
  {addressPanel && (
    <div className="fixed inset-0 z-50 flex justify-end bg-primary/60">
      <section className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-bold text-primary">Select delivery address</h2>
          <button type="button" onClick={() => setAddressPanel(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-primary">Saved addresses</p>
            <button type="button" onClick={addNew} className="flex items-center gap-1 text-sm font-semibold text-secondary"><Plus size={16} /> Add New</button>
          </div>
          {addresses.length > 0 && <div className="space-y-1">{addresses.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-3 hover:bg-slate-50"><input type="radio" name="address-choice" checked={selectedId === item.id} onChange={() => chooseAddress(item)} className="mt-1 h-4 w-4 accent-secondary" /><span className="min-w-0 flex-1"><b className="text-sm text-primary">{item.label || 'Saved address'}</b>{selectedId === item.id && <span className="ml-2 rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] font-bold text-secondary">SELECTED</span>}<span className="mt-1 block truncate text-sm text-slate-500">{item.address}, {item.city} {item.pin}</span></span><ChevronRight size={18} className="mt-1 text-slate-400" /></label>)}</div>}
          <div className="mt-5 border-t border-dashed border-slate-200 pt-5">
            <p className="mb-3 text-sm font-bold text-primary">{selectedId === 'new' ? 'Add new address' : 'Edit selected address'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Full name *</span><input id="delivery-name" required value={contact.name} onChange={(e) => setContact((v) => ({ ...v, name: e.target.value }))} className={inputCls} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-slate-600">Mobile number *</span><input id="delivery-phone" required pattern="[+]?[0-9]{10,15}" value={contact.phone} onChange={(e) => setContact((v) => ({ ...v, phone: e.target.value }))} className={inputCls} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-slate-600">Email</span><input type="email" value={contact.email} onChange={(e) => setContact((v) => ({ ...v, email: e.target.value }))} className={inputCls} /></label>
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Address *</span><textarea id="delivery-address" required rows="2" value={address.address} onChange={(e) => setAddress((v) => ({ ...v, address: e.target.value }))} className={inputCls} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-slate-600">City *</span><input id="delivery-city" required value={address.city} onChange={(e) => setAddress((v) => ({ ...v, city: e.target.value }))} className={inputCls} /></label>
              <label><span className="mb-1 block text-xs font-semibold text-slate-600">PIN code *</span><input id="delivery-pin" required pattern="[0-9]{6}" value={address.pin} onChange={(e) => setAddress((v) => ({ ...v, pin: e.target.value }))} className={inputCls} /></label>
            </div>
            {isLoggedIn && <label className="mt-4 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} className="h-4 w-4 accent-secondary" /> Save this address to my profile</label>}
            <Button type="button" variant="primary" className="mt-5" onClick={saveAddress}>Use this address</Button>
          </div>
        </div>
      </section>
    </div>
  )}</main>;
}
