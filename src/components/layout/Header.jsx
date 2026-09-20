import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, User, ShieldCheck, ChevronDown, Package, LogOut, LayoutGrid, Heart } from 'lucide-react';
import SearchBar from '../common/SearchBar';
import MobileHeader from './MobileHeader';
import useCart from '../../hooks/useCart';
import { useWishlist } from '../../context/WishlistContext';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/suvarna-logo.svg';

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="Suvarna IT Enterprises - Home">
      <img
        src={logo}
        alt="Suvarna IT Enterprises"
        className={compact ? 'h-9 w-auto max-w-[140px] object-contain sm:h-10' : 'h-10 w-auto max-w-[180px] object-contain sm:h-14 lg:h-16'}
      />
    </Link>
  );
}

export function CartLink({ className = '' }) {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-white transition hover:bg-white/10 ${className}`}
    >
      <span className="relative">
        <ShoppingCart size={22} />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-navy-900">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hidden text-sm font-medium xl:inline">Cart</span>
    </Link>
  );
}

export function WishlistLink({ className = '' }) {
  const { items } = useWishlist();
  return (
    <Link
      to="/wishlist"
      aria-label={`Wishlist, ${items.length} item${items.length === 1 ? '' : 's'}`}
      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-white transition hover:bg-white/10 ${className}`}
    >
      <span className="relative">
        <Heart size={22} />
        {items.length > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-navy-900">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </span>
      <span className="hidden text-sm font-medium xl:inline">Wishlist</span>
    </Link>
  );
}

export function UserMenu() {
  const { user, isLoggedIn, logout: logoutAuth } = useAuth();
  const { isAdmin, currentAdmin, currentUser, logout: logoutAdmin } = useAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!isLoggedIn && !isAdmin) {
    return (
      <Link
        to="/login"
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-navy-900 shadow transition hover:bg-accent-dark hover:text-white"
      >
        <User size={16} />
        Login / Register
      </Link>
    );
  }

  const displayUser = isAdmin ? {
    name: currentAdmin?.name || currentAdmin?.email || currentUser || 'Admin',
    email: currentAdmin?.email || currentUser || '',
  } : user;

  const initials = (displayUser.name || 'Admin')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-white transition hover:bg-white/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-navy-900">
          {initials}
        </span>
        <span className="hidden max-w-[90px] truncate text-sm font-medium xl:inline">
          {(displayUser.name || 'Admin').split(' ')[0]}
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-100 bg-surface px-4 py-3">
            <p className="truncate text-sm font-bold text-primary">{displayUser.name}</p>
            <p className="truncate text-xs text-slate-500">{displayUser.email}</p>
          </div>
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-secondary"
          >
            <LayoutGrid size={16} />
            My Account
          </Link>
          <Link
            to="/account?tab=orders"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-secondary"
          >
            <Package size={16} />
            My Orders
          </Link>
          {!isAdmin && (
            <Link
              to="/wishlist"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-secondary"
            >
              <Heart size={16} />
              My Wishlist
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-secondary"
            >
              <ShieldCheck size={16} />
              Admin Panel
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              if (isAdmin) logoutAdmin();
              if (isLoggedIn) logoutAuth();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminHeaderLink() {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;
  return (
    <Link
      to="/admin"
      aria-label="Open admin panel"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-accent transition hover:bg-white/10"
    >
      <ShieldCheck size={18} />
      <span className="hidden xl:inline">Admin</span>
    </Link>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-primary shadow-lg">
      {/* Desktop / tablet header */}
      <div className="hidden lg:block">
        <div className="mx-auto flex max-w-8xl items-center gap-8 px-6 py-3">
          <Logo />
          <div className="mx-auto w-full max-w-2xl flex-1">
            <SearchBar />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AdminHeaderLink />
            <WishlistLink />
            <CartLink />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Mobile / small tablet header */}
      <MobileHeader />
    </header>
  );
}
