import { useEffect, useState } from 'react';
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
  Pencil,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useWishlist } from '../context/WishlistContext';
import useCart from '../hooks/useCart';
import { FALLBACK_IMAGE, formatPrice, handleImgError } from '../utils/helpers';
import Button from '../components/common/Button';
import OrderProductLink from '../components/common/OrderProductLink';
import { StatusBadge, inputCls, labelCls } from '../components/admin/AdminForm';
import { apiRequest } from '../utils/api';
import { getAvailableWishlistProduct, normalizeWishlistProductId } from '../utils/wishlistProducts';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'address', label: 'Address', icon: MapPin },
];

const getSavedAddresses = (user) => {
  if (Array.isArray(user?.addresses) && user.addresses.length) return user.addresses;
  if (user?.address || user?.city || user?.pin) {
    return [{ id: 'legacy-address', label: 'Saved address', address: user.address || '', city: user.city || '', pin: user.pin || '' }];
  }
  return [];
};

const createAddressId = () =>
  `address-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const invoiceAmount = (amountPaise) => `INR ${(amountPaise / 100).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
const toPaise = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

async function downloadInvoice(order, settings) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const right = pageWidth - margin;
  const drawTableHeader = (y) => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y - 5, pageWidth - margin * 2, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('ITEM', margin + 2, y + 1);
    pdf.text('QTY', 116, y + 1, { align: 'center' });
    pdf.text('UNIT PRICE', 151, y + 1, { align: 'right' });
    pdf.text('AMOUNT', right - 2, y + 1, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    return y + 12;
  };
  const seller = order.sellerSnapshot || {};
  const sellerName = seller.storeName || seller.businessName || settings.storeName || 'Suvarna IT Enterprises';
  const sellerEmail = seller.email || settings.email || '';
  const sellerPhone = seller.phone || settings.phone || '';
  const sellerAddress = seller.address || settings.address || '';
  const sellerAddressLines = sellerAddress ? pdf.splitTextToSize(sellerAddress, 105) : [];
  const headerBottom = Math.max(44, sellerAddressLines.length ? 34 + sellerAddressLines.length * 3.5 + 4 : 44);

  pdf.setFillColor(15, 35, 63);
  pdf.rect(0, 0, pageWidth, headerBottom, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(sellerName, margin, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(sellerEmail, margin, 23);
  pdf.text(sellerPhone, margin, 28);
  if (sellerAddressLines.length) pdf.text(sellerAddressLines, margin, 34);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.text('INVOICE', right, 18, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Invoice #${order.id}`, right, 26, { align: 'right' });
  pdf.text(`Order date: ${order.date || 'Not recorded'}`, right, 32, { align: 'right' });
  pdf.text('Status: Delivered', right, 38, { align: 'right' });

  const billToLines = pdf.splitTextToSize(
    [order.customer, order.email, order.phone].filter(Boolean).join('\n') || '-',
    82
  );
  const shipping = order.shippingAddress || {};
  const deliveredToLines = pdf.splitTextToSize(
    [shipping.address, shipping.city, shipping.pin].filter(Boolean).join(', ') || '-',
    right - 112
  );
  let sectionY = headerBottom + 10;
  let billedOffset = 0;
  let deliveredOffset = 0;
  let y = sectionY;
  pdf.setTextColor(15, 35, 63);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  while (billedOffset < billToLines.length || deliveredOffset < deliveredToLines.length) {
    if (sectionY + 15 > pageHeight - margin) {
      pdf.addPage();
      sectionY = 20;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(billedOffset ? 'BILLED TO (CONT.)' : 'BILLED TO', margin, sectionY);
    pdf.text(deliveredOffset ? 'DELIVERED TO (CONT.)' : 'DELIVERED TO', 112, sectionY);
    const textY = sectionY + 7;
    const linesPerPage = Math.max(1, Math.floor((pageHeight - margin - textY - 8) / 5));
    const billedChunk = billToLines.slice(billedOffset, billedOffset + linesPerPage);
    const deliveredChunk = deliveredToLines.slice(deliveredOffset, deliveredOffset + linesPerPage);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    if (billedChunk.length) pdf.text(billedChunk, margin, textY);
    if (deliveredChunk.length) pdf.text(deliveredChunk, 112, textY);
    const blockLines = Math.max(billedChunk.length, deliveredChunk.length);
    billedOffset += billedChunk.length;
    deliveredOffset += deliveredChunk.length;
    y = textY + blockLines * 5 + 10;
    if (billedOffset < billToLines.length || deliveredOffset < deliveredToLines.length) {
      pdf.addPage();
      sectionY = 20;
    }
  }
  if (y + 22 > pageHeight - margin) {
    pdf.addPage();
    y = 20;
  }
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, y - 6, right, y - 6);
  y = drawTableHeader(y);
  pdf.setFontSize(9);
  pdf.setTextColor(30, 41, 59);

  for (const item of order.items || []) {
    const nameLines = pdf.splitTextToSize(item.name || 'Product', 78);
    const rowHeight = Math.max(12, nameLines.length * 5 + 3);
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      y = drawTableHeader(20);
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
    }
    const quantity = Math.max(1, Math.trunc(Number(item.qty) || 1));
    const unitPricePaise = toPaise(item.price);
    pdf.text(nameLines, margin + 2, y);
    pdf.text(String(quantity), 116, y, { align: 'center' });
    pdf.text(invoiceAmount(unitPricePaise), 151, y, { align: 'right' });
    pdf.text(invoiceAmount(unitPricePaise * quantity), right - 2, y, { align: 'right' });
    y += rowHeight;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y - 2, right, y - 2);
  }

  const itemSubtotalPaise = (order.items || []).reduce(
    (sum, item) => sum + toPaise(item.price) * Math.max(1, Math.trunc(Number(item.qty) || 1)),
    0,
  );
  const totalPaise = toPaise(order.total);
  const deliveryFeePaise = Math.max(0, totalPaise - itemSubtotalPaise);
  if (y + 28 > pageHeight - margin) {
    pdf.addPage();
    y = 24;
  }
  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Payment method', margin, y);
  pdf.text(order.payment === 'cod' ? 'Cash on Delivery' : order.payment || 'Not recorded', margin + 38, y);
  pdf.text('Item subtotal', 151, y, { align: 'right' });
  pdf.text(invoiceAmount(itemSubtotalPaise), right - 2, y, { align: 'right' });
  pdf.text('Delivery fee', 151, y + 6, { align: 'right' });
  pdf.text(deliveryFeePaise ? invoiceAmount(deliveryFeePaise) : 'FREE', right - 2, y + 6, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('TOTAL', 151, y + 16, { align: 'right' });
  pdf.text(invoiceAmount(totalPaise), right - 2, y + 16, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Thank you for shopping with us.', margin, pageHeight - 10);

  const safeOrderId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '-');
  const blobUrl = URL.createObjectURL(pdf.output('blob'));
  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  downloadLink.download = `invoice-${safeOrderId}.pdf`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export default function Account() {
  const { user, isLoggedIn, logout, updateProfile, refreshSession, upsertAddress, deleteAddress } = useAuth();
  const { settings, storefrontProducts } = useAdmin();
  const { items: wishlistItems, removeItem, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'profile');
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [addressEditor, setAddressEditor] = useState(null);
  const [addressDraft, setAddressDraft] = useState({ label: '', address: '', city: '', pin: '' });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');

  const savedAddresses = getSavedAddresses(user);
  const currentProductsById = new Map(
    storefrontProducts.map((product) => [normalizeWishlistProductId(product.id), product])
  );

  useEffect(() => {
    if (!isLoggedIn) {
      setMyOrders([]);
      return undefined;
    }
    let active = true;
    const refreshOrders = async () => {
      try {
        const result = await apiRequest('customer-orders', {
          query: { expectedEmail: String(user.email || '').trim().toLowerCase() },
        });
        if (active) {
          setMyOrders(result.orders);
          setOrdersError('');
        }
      } catch (error) {
        if (active && error.status === 409) {
          setMyOrders([]);
          await refreshSession();
        }
        if (active) setOrdersError(error.message);
      }
    };
    refreshOrders();
    const intervalId = window.setInterval(refreshOrders, 15_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') refreshOrders();
    };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [isLoggedIn, user?.email, refreshSession]);

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const phone = form.phone.value.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phone && (!/^[+0-9 ().-]+$/.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setProfileError('Enter a valid phone number with 10 to 15 digits.');
      form.phone.focus();
      return;
    }
    const result = await updateProfile({ name: form.name.value, phone });
    if (result.status === 409) setMyOrders([]);
    setProfileError(result.ok ? '' : result.error);
    setSaved(result.ok);
    if (result.ok) setTimeout(() => setSaved(false), 2500);
  };

  const handleAddressSave = async (e) => {
    e.preventDefault();
    const currentAddress = savedAddresses.find((item) => String(item.id) === String(addressEditor));
    const isCreating = addressEditor === 'new' ||
      currentAddress?.version == null ||
      !Number.isInteger(Number(currentAddress.version));
    const cleanAddress = {
      id: isCreating
        ? (addressDraft.id || createAddressId())
        : currentAddress.id,
      label: addressDraft.label.trim() || `Address ${savedAddresses.length + (addressEditor === 'new' ? 1 : 0)}`,
      address: addressDraft.address.trim(),
      city: addressDraft.city.trim(),
      pin: addressDraft.pin.trim(),
    };
    const result = await upsertAddress(
      cleanAddress,
      isCreating ? 0 : Number(currentAddress.version)
    );
    if (!result.ok) {
      if (result.status === 409) {
        setMyOrders([]);
        setAddressEditor(null);
      }
      setProfileError(result.error);
      return;
    }
    setAddressEditor(null);
    setProfileError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const openNewAddress = () => {
    setAddressDraft({ id: createAddressId(), label: '', address: '', city: '', pin: '' });
    setAddressEditor('new');
  };

  const openEditAddress = (address) => {
    setAddressDraft({
      ...address,
      id: address.version != null && Number.isInteger(Number(address.version))
        ? address.id
        : createAddressId(),
    });
    setAddressEditor(address.id);
  };

  const removeAddress = async (id) => {
    const address = savedAddresses.find((item) => String(item.id) === String(id));
    const result = await deleteAddress(
      id,
      address?.version == null ? undefined : Number(address.version)
    );
    if (!result.ok) {
      if (result.status === 409) setMyOrders([]);
      setProfileError(result.error);
      return;
    }
    setProfileError('');
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
                {(user.providers || [user.provider]).includes('google') ? (
                  <>
                    <ShieldCheck size={10} />
                    {(user.providers || [user.provider]).includes('email') ? 'Google + Email Account' : 'Google Account'}
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
          {profileError && tab !== 'profile' && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              {profileError}
            </p>
          )}
          {saved && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> Saved successfully!
            </p>
          )}

          {tab === 'profile' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <h2 className="text-base font-bold text-primary">Profile Information</h2>
              {profileError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  {profileError}
                </p>
              )}
              <form onSubmit={handleProfileSave} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ac-name" className={labelCls}>Full Name</label>
                  <input id="ac-name" name="name" defaultValue={user.name} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ac-phone" className={labelCls}>Mobile Number</label>
                  <input id="ac-phone" name="phone" type="tel" pattern="[+]?[0-9 ().-]*" title="Leave blank or enter a valid phone number with 10 to 15 digits." defaultValue={user.phone} className={inputCls} />
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
              {ordersError && (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                  Could not refresh your order status: {ordersError}
                </p>
              )}
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-primary">My Orders ({myOrders.length})</h2>
                  <p className="mt-1 text-xs text-slate-500">Your purchases and delivery updates</p>
                </div>
              </div>
              {myOrders.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
                  <ShoppingBag size={44} className="text-slate-300" />
                  <p className="text-sm text-slate-500">You have not placed any orders yet.</p>
                  <Button to="/products" variant="primary" size="sm">Start Shopping</Button>
                </div>
              ) : (
                <ul className="mt-4 space-y-4">
                  {myOrders.map((o) => (
                    <li key={o.id} className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-slate-50 px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Order placed</p>
                            <p className="mt-0.5 text-sm font-semibold text-primary">{o.date || 'Date unavailable'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Order ID</p>
                            <p className="mt-0.5 text-sm font-semibold text-primary">#{o.id}</p>
                          </div>
                        </div>
                        <StatusBadge status={o.status || 'Pending'} />
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {(o.items || []).map((item, index) => (
                          <li key={`${o.id}-${item.id || item.name || index}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                            <OrderProductLink item={item} className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-md bg-slate-50" aria-label={`View ${item.name || 'ordered product'}`}>
                              <img src={item.image || item.images?.[0] || FALLBACK_IMAGE} alt={item.name || ''} onError={handleImgError} className="h-full w-full object-contain p-1" />
                            </OrderProductLink>
                            <div className="min-w-0">
                              <OrderProductLink item={item} className="line-clamp-2 text-sm font-semibold text-primary hover:text-secondary">{item.name || 'Product'}</OrderProductLink>
                              <p className="mt-1 text-xs text-slate-500">{item.brand || 'Suvarna IT Enterprises'} <span className="px-1 text-slate-300">·</span> Qty {item.qty || 1}</p>
                              <p className="mt-2 text-xs text-slate-500">{o.status === 'Delivered' ? 'Delivered' : o.status === 'Cancelled' ? 'Order cancelled' : o.status === 'Shipped' ? 'On the way' : o.status === 'Processing' ? 'Being prepared' : 'Order received'}</p>
                            </div>
                            <div className="sm:text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Item total</p>
                              <p className="mt-0.5 text-sm font-bold text-primary">{formatPrice((item.price || 0) * (item.qty || 1))}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            type="button"
                            aria-expanded={expandedOrder === o.id}
                            aria-controls={`order-details-${o.id}`}
                            onClick={() => setExpandedOrder((current) => current === o.id ? null : o.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary"
                          >
                            {expandedOrder === o.id ? <>Hide order details <ChevronUp size={14} /></> : <>Order details <ChevronDown size={14} /></>}
                          </button>
                          {o.status === 'Delivered' && (
                            <button
                              type="button"
                              onClick={() => downloadInvoice(o, settings)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary"
                              aria-label={`Download invoice for order ${o.id}`}
                            >
                              <Download size={14} /> Download invoice
                            </button>
                          )}
                        </div>
                        <p className="text-sm font-bold text-primary">Order total <span className="ml-2">{formatPrice(o.total || 0)}</span></p>
                      </div>
                      {expandedOrder === o.id && (
                        <div id={`order-details-${o.id}`} className="grid gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-4 text-xs sm:grid-cols-2 sm:px-5">
                          <div>
                            <p className="font-bold text-primary">Delivery address</p>
                            <p className="mt-1 leading-5 text-slate-600">{[o.shippingAddress?.address, o.shippingAddress?.city, o.shippingAddress?.pin].filter(Boolean).join(', ') || 'Address details unavailable'}</p>
                          </div>
                          <div>
                            <p className="font-bold text-primary">Payment method</p>
                            <p className="mt-1 text-slate-600">{o.payment === 'cod' ? 'Cash on Delivery' : o.payment || 'Not specified'}</p>
                          </div>
                        </div>
                      )}
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
                  {wishlistItems.map((product) => {
                    const currentProduct = getAvailableWishlistProduct(product, currentProductsById);
                    return (
                    <article key={product.id} className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="relative">
                        <Link to={`/product/${product.id}`}> 
                          <img
                            src={currentProduct?.images?.[0] || currentProduct?.image || product.images?.[0] || product.image || FALLBACK_IMAGE}
                            alt={currentProduct?.name || product.name}
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
                        <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">{currentProduct?.brand || product.brand}</span>
                        <h3 className="mt-1 line-clamp-2 text-sm font-bold text-primary">{currentProduct?.name || product.name}</h3>
                        <p className="mt-1 text-sm font-extrabold text-primary">{formatPrice(currentProduct?.price ?? product.price)}</p>
                        {!currentProduct && <p className="mt-2 text-xs font-medium text-amber-700">This saved product is unavailable or has changed in the catalogue. Review it before adding.</p>}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (currentProduct) addItem(currentProduct, 1);
                            }}
                            disabled={!currentProduct}
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
            </section>
          )}

          {tab === 'address' && (
            <section className="rounded-xl bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-base font-bold text-primary">Saved Delivery Addresses</h2><p className="mt-1 text-xs text-slate-500">Select one of these addresses at checkout.</p></div>
                <Button type="button" variant="secondary" size="sm" onClick={openNewAddress}><MapPin size={15} /> Add Address</Button>
              </div>

              {savedAddresses.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">No saved addresses. Add one for faster checkout.</p> : (
                <ul className="mt-5 space-y-3">
                  {savedAddresses.map((address) => (
                    <li key={address.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-4">
                      <div><p className="text-sm font-bold text-primary">{address.label || 'Saved address'}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{address.address}<br />{address.city} {address.pin}</p></div>
                      <div className="flex shrink-0 gap-1"><button type="button" onClick={() => openEditAddress(address)} aria-label={`Edit ${address.label || 'address'}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary"><Pencil size={15} /></button><button type="button" onClick={() => removeAddress(address.id)} aria-label={`Remove ${address.label || 'address'}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div>
                    </li>
                  ))}
                </ul>
              )}

              {addressEditor && (
                <form onSubmit={handleAddressSave} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-primary">{addressEditor === 'new' ? 'Add New Address' : 'Edit Address'}</h3>
                  <div className="mt-4 grid gap-4"><div><label htmlFor="ac-label" className={labelCls}>Address Label</label><input id="ac-label" value={addressDraft.label} onChange={(event) => setAddressDraft((current) => ({ ...current, label: event.target.value }))} className={inputCls} placeholder="Home, Office, etc." /></div><div><label htmlFor="ac-address" className={labelCls}>Address</label><textarea id="ac-address" required rows="2" value={addressDraft.address} onChange={(event) => setAddressDraft((current) => ({ ...current, address: event.target.value }))} className={inputCls} placeholder="Street, building, landmark" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="ac-city" className={labelCls}>City</label><input id="ac-city" required value={addressDraft.city} onChange={(event) => setAddressDraft((current) => ({ ...current, city: event.target.value }))} className={inputCls} placeholder="City" /></div><div><label htmlFor="ac-pin" className={labelCls}>PIN Code</label><input id="ac-pin" required pattern="[0-9]{6}" value={addressDraft.pin} onChange={(event) => setAddressDraft((current) => ({ ...current, pin: event.target.value }))} className={inputCls} placeholder="560001" /></div></div><div className="flex gap-3"><Button type="submit" variant="primary"><Save size={16} /> Save Address</Button><Button type="button" variant="ghost" onClick={() => setAddressEditor(null)}>Cancel</Button></div></div>
                </form>
              )}
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
