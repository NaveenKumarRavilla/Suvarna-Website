import { useEffect, useState } from 'react';
import { Trash2, Mail, Phone, ShieldCheck, RefreshCw, Download, UserPlus, Pencil } from 'lucide-react';
import Button from '../../components/common/Button';
import { Field, Modal, PageHeader, inputCls, tableWrap, tableCls, thCls, tdCls } from '../../components/admin/AdminForm';
import { apiRequest } from '../../utils/api';
import { downloadCsv } from '../../utils/csv';
import { useAdmin } from '../../context/AdminContext';

const customerCsvHeaders = ['id', 'name', 'email', 'phone', 'address', 'city', 'pin', 'provider', 'providers', 'orders', 'joined'];
const emptyCustomerForm = { name: '', email: '', phone: '', address: '', city: '', pin: '' };

export default function AdminCustomers() {
  const { refreshAdminProfile } = useAdmin();
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [notice, setNotice] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [phoneEditCustomer, setPhoneEditCustomer] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const handleAccessError = async (requestError) => {
    setError(requestError.message);
    if (requestError.status !== 403) return;
    setCustomers([]);
    setCustomerModalOpen(false);
    setPhoneEditCustomer(null);
    setPhoneDraft('');
    try {
      await refreshAdminProfile();
    } catch (profileError) {
      console.error('Could not refresh admin permissions after customer access was revoked.', profileError);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('customers-list');
      setCustomers(result.customers);
      setError('');
    } catch (requestError) {
      await handleAccessError(requestError);
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
      await handleAccessError(requestError);
    }
  };

  const exportCustomers = () => {
    downloadCsv(
      'suvarna-customers.csv',
      customerCsvHeaders,
      customers.map((customer) => customerCsvHeaders.map((header) => {
        const value = header === 'joined' ? customer.joined : customer[header];
        return Array.isArray(value) ? value.join(', ') : value ?? '';
      })),
    );
  };

  const addCustomer = async (event) => {
    event.preventDefault();
    setSavingCustomer(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('customers-import', {
        method: 'POST',
        body: { customers: [customerForm], createOnly: true },
      });
      setNotice(result.created
        ? 'Customer profile added. The customer can sign in with Google using this email and set a password after verification.'
        : 'Customer profile updated.');
      setCustomerModalOpen(false);
      setCustomerForm(emptyCustomerForm);
      await loadCustomers();
    } catch (requestError) {
      await handleAccessError(requestError);
    } finally {
      setSavingCustomer(false);
    }
  };

  const saveCustomerPhone = async (event) => {
    event.preventDefault();
    if (!phoneEditCustomer) return;
    setSavingPhone(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('customers-update-phone', {
        method: 'POST',
        body: { id: phoneEditCustomer.id, phone: phoneDraft.trim() },
      });
      setCustomers((current) => current.map((customer) => (
        String(customer.id) === String(phoneEditCustomer.id)
          ? { ...customer, phone: result.phone }
          : customer
      )));
      setPhoneEditCustomer(null);
      setPhoneDraft('');
    } catch (requestError) {
      await handleAccessError(requestError);
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Manage Customers"
        subtitle={`${customers.length} registered customers`}
        action={
          <>
            <Button type="button" variant="primary" size="sm" onClick={() => { setCustomerForm(emptyCustomerForm); setError(''); setCustomerModalOpen(true); }}>
              <UserPlus size={14} />Add Customer
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={exportCustomers} disabled={loading || customers.length === 0}><Download size={14} />Export CSV</Button>
            <Button type="button" variant="secondary" size="sm" onClick={loadCustomers} disabled={loading}><RefreshCw size={14} />{loading ? 'Refreshing...' : 'Refresh'}</Button>
          </>
        }
      />
      <p className="mb-4 text-xs text-slate-500">Customer data can be exported for reporting. The CSV includes contact details, login provider and order count; passwords are never exported. New profiles can be added individually.</p>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</p>}
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
                      <Phone size={12} /> {c.phone || 'Not provided'}
                      <button
                        type="button"
                        onClick={() => { setPhoneEditCustomer(c); setPhoneDraft(c.phone || ''); setError(''); }}
                        aria-label={`Edit phone number for ${c.name}`}
                        title="Edit phone number"
                        className="ml-1 rounded p-1 text-slate-400 transition hover:bg-secondary/10 hover:text-secondary"
                      >
                        <Pencil size={12} />
                      </button>
                    </span>
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      c.provider === 'google' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {c.provider === 'google' && <ShieldCheck size={11} />}
                      {c.providers?.length
                        ? c.providers.map((provider) => provider === 'google' ? 'Google' : 'Email').join(' + ')
                        : c.provider === 'google' ? 'Google' : c.provider === 'profile' ? 'Profile only' : 'Email'}
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
      {customerModalOpen && (
        <Modal title="Add Customer Profile" onClose={() => !savingCustomer && setCustomerModalOpen(false)}>
          <form onSubmit={addCustomer} className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <Field label="Name *">
              <input required maxLength={160} value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Email *">
              <input required type="email" maxLength={254} value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input type="tel" maxLength={40} value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} className={inputCls} />
            </Field>
            <Field label="Address">
              <input maxLength={500} value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input maxLength={120} value={customerForm.city} onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))} className={inputCls} />
              </Field>
              <Field label="PIN code">
                <input maxLength={20} value={customerForm.pin} onChange={(event) => setCustomerForm((current) => ({ ...current, pin: event.target.value }))} className={inputCls} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">A profile is created without a password. The customer can verify ownership with Google before setting one.</p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCustomerModalOpen(false)} disabled={savingCustomer}>Cancel</Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={savingCustomer}>{savingCustomer ? 'Saving...' : 'Add Customer'}</Button>
            </div>
          </form>
        </Modal>
      )}
      {phoneEditCustomer && (
        <Modal title={`Edit Phone — ${phoneEditCustomer.name}`} onClose={() => !savingPhone && setPhoneEditCustomer(null)}>
          <form onSubmit={saveCustomerPhone} className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <Field label="Phone number">
              <input
                autoFocus
                type="tel"
                maxLength={40}
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                className={inputCls}
                placeholder="+91 98765 43210"
              />
            </Field>
            <p className="text-xs text-slate-500">Leave blank to remove the phone number. Otherwise enter 10–15 digits.</p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setPhoneEditCustomer(null)} disabled={savingPhone}>Cancel</Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={savingPhone}>{savingPhone ? 'Saving...' : 'Save Phone'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
