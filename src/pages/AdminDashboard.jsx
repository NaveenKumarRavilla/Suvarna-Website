import { Link } from 'react-router-dom';
import {
  Package,
  Images,
  Youtube,
  ShoppingBag,
  Users,
  MessageSquare,
  BadgePercent,
  FolderTree,
  ArrowRight,
  IndianRupee,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { formatPrice } from '../utils/helpers';
import { StatusBadge } from '../components/admin/AdminForm';

export default function AdminDashboard() {
  const { products, banners, videos, orders, customers, enquiries, offers } = useAdmin();

  const revenue = orders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const stats = [
    { label: 'Products', value: products.length, icon: Package, to: '/admin/products', color: 'bg-blue-100 text-blue-600' },
    { label: 'Banners', value: banners.length, icon: Images, to: '/admin/banners', color: 'bg-violet-100 text-violet-600' },
    { label: 'Videos', value: videos.length, icon: Youtube, to: '/admin/videos', color: 'bg-rose-100 text-rose-600' },
    { label: 'Orders', value: orders.length, icon: ShoppingBag, to: '/admin/orders', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Customers', value: customers.length, icon: Users, to: '/admin/customers', color: 'bg-amber-100 text-amber-600' },
    { label: 'Enquiries', value: enquiries.filter((e) => e.status === 'New').length, icon: MessageSquare, to: '/admin/enquiries', color: 'bg-cyan-100 text-cyan-600' },
    { label: 'Active Offers', value: offers.filter((o) => o.active).length, icon: BadgePercent, to: '/admin/offers', color: 'bg-orange-100 text-orange-600' },
    { label: 'Categories', value: 8, icon: FolderTree, to: '/admin/categories', color: 'bg-slate-200 text-slate-600' },
  ];

  return (
    <div>
      <h1 className="text-xl font-extrabold text-primary sm:text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview of your store at a glance.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className="group rounded-xl bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon size={20} />
            </span>
            <p className="mt-3 text-2xl font-extrabold text-primary">{value}</p>
            <p className="flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-secondary">
              {label}
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <IndianRupee size={18} className="text-secondary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
            Total Revenue
          </h2>
        </div>
        <p className="mt-2 text-3xl font-black text-primary">{formatPrice(revenue)}</p>
        <p className="mt-1 text-xs text-slate-500">From {orders.length} order(s)</p>
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
          Recent Orders
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No orders yet. Orders placed on the storefront will appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold text-primary">#{o.id}</span>
                <span className="text-slate-500">{o.customer || 'Guest'}</span>
                <span className="font-bold text-primary">{formatPrice(o.total)}</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
