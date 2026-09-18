import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderTree,
  Package,
  Images,
  Youtube,
  ShoppingBag,
  Users,
  MessageSquare,
  BadgePercent,
  Settings as SettingsIcon,
  LogOut,
  Store,
  Menu,
  X,
  Cpu,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/categories', label: 'Manage Categories', icon: FolderTree },
  { to: '/admin/products', label: 'Manage Products', icon: Package },
  { to: '/admin/banners', label: 'Manage Banners / Sliders', icon: Images },
  { to: '/admin/videos', label: 'Manage Videos', icon: Youtube },
  { to: '/admin/orders', label: 'Manage Orders', icon: ShoppingBag },
  { to: '/admin/customers', label: 'Manage Customers', icon: Users },
  { to: '/admin/enquiries', label: 'Manage Enquiries', icon: MessageSquare },
  { to: '/admin/offers', label: 'Manage Offers', icon: BadgePercent },
  { to: '/admin/settings', label: 'Manage Settings', icon: SettingsIcon },
];

function Sidebar({ onNavigate }) {
  const { currentUser, logout, hasPermission, isMaster } = useAdmin();
  const visibleItems = navItems.filter((item) => item.end || isMaster || hasPermission(item.to.replace('/admin/', '')));
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-accent">
          <Cpu size={18} />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-wide text-primary">SUVARNA</span>
          <span className="block text-[9px] font-semibold tracking-[0.25em] text-accent-dark">ADMIN PANEL</span>
        </span>
      </div>

      <nav aria-label="Admin controls" className="flex-1 overflow-y-auto py-3">
        <p className="px-5 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Admin Controls
        </p>
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-accent bg-secondary/5 text-secondary'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-primary'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <p className="truncate text-xs text-slate-400">Logged in as</p>
        <p className="truncate text-sm font-semibold text-primary">{currentUser}</p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-secondary hover:text-secondary"
          >
            <Store size={13} />
            Storefront
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { isAdmin, currentUser } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/login', { replace: true, state: { email: currentUser || '' } });
    }
  }, [isAdmin, currentUser, navigate]);

  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return (
    <div className="mx-auto max-w-8xl px-4 py-6">
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-28 hidden h-[calc(100vh-140px)] w-64 shrink-0 overflow-hidden rounded-xl bg-white shadow-card lg:block">
          <Sidebar />
        </aside>

        {/* Mobile sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[65] lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="absolute left-0 top-0 h-full w-[280px] overflow-y-auto bg-white shadow-2xl">
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  aria-label="Close admin menu"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm lg:hidden"
          >
            <Menu size={16} />
            Admin Menu
          </button>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function AdminPermission({ permission, children }) {
  const { isAdmin, hasPermission } = useAdmin();
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  if (permission && !hasPermission(permission)) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-card">
        <h1 className="text-xl font-extrabold text-primary">Permission required</h1>
        <p className="mt-2 text-sm text-slate-500">Your admin role cannot access this control.</p>
        <Link to="/admin" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Back to Dashboard
        </Link>
      </div>
    );
  }
  return children;
}
