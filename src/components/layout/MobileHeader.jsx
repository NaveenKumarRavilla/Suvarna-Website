import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, User, X, LogOut } from 'lucide-react';
import SearchBar from '../common/SearchBar';
import { Logo, CartLink, WishlistLink } from './Header';
import { navCategories } from '../../data/categories';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';

export function categoryLink(cat) {
  if (cat.path) return cat.path;
  if (cat.id === 'offers') return '/products?offers=true';
  return `/products?category=${cat.id}`;
}

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, isLoggedIn, logout: logoutAuth } = useAuth();
  const { isAdmin, currentAdmin, currentUser, logout: logoutAdmin } = useAdmin();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const displayName = isAdmin ? (currentAdmin?.name || currentAdmin?.email || currentUser || 'Admin') : user?.name || 'User';
  const displayInitials = displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-white transition hover:bg-white/10"
        >
          <Menu size={22} />
        </button>
        <Logo />
        <div className="flex items-center">
          <WishlistLink className="px-2" />
          <CartLink className="px-2" />
          <Link
            to={isLoggedIn || isAdmin ? (isAdmin ? '/admin' : '/account') : '/login'}
            aria-label={isLoggedIn || isAdmin ? 'My account' : 'Login or Register'}
            className="rounded-lg p-2 text-white transition hover:bg-white/10"
          >
            {isLoggedIn || isAdmin ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-navy-900">
                {displayInitials}
              </span>
            ) : (
              <User size={20} />
            )}
          </Link>
        </div>
      </div>
      <div className="px-3 pb-3">
        <SearchBar />
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-primary px-4 py-4">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-white transition hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 py-2" aria-label="Mobile categories">
              {navCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={categoryLink(cat)}
                  className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-surface hover:text-secondary"
                >
                  <cat.icon size={18} className="text-secondary" />
                  {cat.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-100 p-4">
              {isLoggedIn || isAdmin ? (
                <div className="space-y-2">
                  <Link
                    to={isAdmin ? '/admin' : '/account'}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <User size={16} />
                    {displayName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (isAdmin) logoutAdmin();
                      if (isLoggedIn) logoutAuth();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <User size={16} />
                  Login / Register
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
