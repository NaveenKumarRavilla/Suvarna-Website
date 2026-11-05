import { useEffect, useState } from 'react';
import { Trash2, Mail, Phone, ShieldCheck, RefreshCw } from 'lucide-react';
import Button from '../../components/common/Button';
import { PageHeader, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';
import { apiRequest } from '../../utils/api';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('customers-list');
      setCustomers(result.customers);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    const intervalId = window.setInterval(loadCustomers, 15_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') loadCustomers();
    };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, []);

  const handleDelete = async (id) => {
    try {
      await apiRequest('customers-delete', { method: 'POST', body: { id } });
      setCustomers((current) => current.filter((customer) => customer.id !== id));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Customers"
        subtitle={`${customers.length} registered customers`}
        action={<Button type="button" variant="secondary" size="sm" onClick={loadCustomers} disabled={loading}><RefreshCw size={14} />{loading ? 'Refreshing...' : 'Refresh'}</Button>}
      />
      <p className="mb-4 text-xs text-slate-500">Customer accounts and matching order counts are shared through the Hostinger database.</p>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
      {customers.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <p className="text-sm text-slate-500">{error ? 'Customer data could not be loaded.' : 'No customers yet. Users who register or sign in with Google will appear here.'}</p>
        </div>
      ) : (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={thCls}>Customer</th>
                <th className={thCls}>Contact</th>
                <th className={thCls}>Provider</th>
                <th className={thCls}>Orders</th>
                <th className={thCls}>Joined</th>
                <th className={thCls}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50">
                  <td className={tdCls}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                        {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-semibold text-primary">{c.name}</span>
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail size={12} /> {c.email}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone size={12} /> {c.phone}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      c.provider === 'google' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {c.provider === 'google' && <ShieldCheck size={11} />}
                      {c.providers?.length
                        ? c.providers.map((provider) => provider === 'google' ? 'Google' : 'Email').join(' + ')
                        : c.provider === 'google' ? 'Google' : 'Email'}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-bold text-secondary">
                      {c.orders ?? 0}
                    </span>
                  </td>
                  <td className={tdCls}>{c.joined}</td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      aria-label={`Remove customer ${c.name}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
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
