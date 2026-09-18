import { useEffect } from 'react';
import { Trash2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { getRegisteredCustomers } from '../../context/AuthContext';
import { PageHeader, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';

export default function AdminCustomers() {
  const { customers, deleteCustomer, syncCustomers } = useAdmin();

  // Pull live registered users (auth store) into the admin customer list
  useEffect(() => {
    syncCustomers(getRegisteredCustomers());
  }, [syncCustomers]);

  return (
    <div>
      <PageHeader title="Manage Customers" subtitle={`${customers.length} registered customers`} />
      {customers.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-card">
          <p className="text-sm text-slate-500">No customers yet. Users who register or sign in with Google will appear here.</p>
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
                      {c.provider === 'google' ? 'Google' : 'Email'}
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-bold text-secondary">
                      {c.orders}
                    </span>
                  </td>
                  <td className={tdCls}>{c.joined}</td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      onClick={() => deleteCustomer(c.id)}
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
