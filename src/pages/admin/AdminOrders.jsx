import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { formatPrice } from '../../utils/helpers';
import { PageHeader, tableWrap, tableCls, thCls, tdCls, inputCls } from '../../components/admin/AdminForm';

const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function AdminOrders() {
  const { orders, updateOrderStatus } = useAdmin();
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return orders;

    return orders.filter((o) => {
      const customer = (o.customer || 'Guest').toLowerCase();
      const mobile = (o.phone || '').toLowerCase();
      const orderId = String(o.id || '').toLowerCase();

      return orderId.includes(keyword)
        || customer.includes(keyword)
        || mobile.includes(keyword);
    });
  }, [orders, search]);

  return (
    <div>
      <PageHeader title="Manage Orders" subtitle={`${orders.length} total orders`} />

      <div className="mb-4 rounded-xl bg-white p-3 shadow-card">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
            placeholder="Search by order ID, customer name or mobile number"
            aria-label="Search orders"
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <p className="text-sm text-slate-500">
            {orders.length === 0 ? 'No orders yet. Orders placed on the storefront checkout will appear here.' : 'No matching orders found.'}
          </p>
        </div>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thCls}>Order ID</th>
                <th className={thCls}>Customer</th>
                <th className={thCls}>Product Details</th>
                <th className={thCls}>Total</th>
                <th className={thCls}>Date</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="transition hover:bg-slate-50">
                  <td className={`${tdCls} font-semibold text-primary`}>#{o.id}</td>
                  <td className={tdCls}>
                    <span className="block font-medium">{o.customer || 'Guest'}</span>
                    <span className="block text-xs text-slate-400">{o.email || ''}</span>
                    <span className="block text-xs text-slate-400">{o.phone || ''}</span>
                  </td>
                  <td className={tdCls}>
                    <div className="space-y-1">
                      {(o.items || []).map((item, idx) => (
                        <Link
                          key={`${o.id}-${item.name || 'item'}-${idx}`}
                          to={item.id ? `/product/${item.id}` : '#'}
                          className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 transition hover:bg-secondary/10"
                          aria-label={`Open product ${item.name || 'details'} in storefront`}
                        >
                          <span className="h-7 w-7 overflow-hidden rounded bg-white shadow-sm">
                            {(item.image || item.images?.[0]) && (
                              <img src={item.image || item.images?.[0]} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-primary">{item.name || 'Product'}</span>
                            <span className="block text-[11px] text-slate-500">
                              {item.brand || ''} • Qty {item.qty || 0} • {formatPrice(item.price || 0)}
                            </span>
                          </span>
                          <ExternalLink size={12} className="ml-auto shrink-0 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className={`${tdCls} font-bold`}>{formatPrice(o.total)}</td>
                  <td className={tdCls}>{o.date || '-'}</td>
                  <td className={tdCls}>
                    <select
                      value={o.status || 'Pending'}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      aria-label={`Status of order ${o.id}`}
                      className={`${inputCls} !w-auto !py-1.5 text-xs font-semibold`}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
