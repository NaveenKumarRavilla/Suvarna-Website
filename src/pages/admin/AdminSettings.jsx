import { useEffect, useRef, useState } from 'react';
import { Save, CheckCircle2, Crown, Trash2, UserPlus } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import {
  Field,
  PageHeader,
  StatusBadge,
  inputCls,
} from '../../components/admin/AdminForm';

const SETTINGS_FORM_DRAFT_KEY = 'suvarna_admin_settings_form_draft';

export default function AdminSettings() {
  const { settings, updateSettings, admins, addAdmin, removeAdmin, isMaster, setAdminFormDirty } = useAdmin();
  const [form, setForm] = useState(settings);
  const [editBase, setEditBase] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [newAdmin, setNewAdmin] = useState('');
  const [notice, setNotice] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingAdmin, setRemovingAdmin] = useState('');
  const restoredDraftRef = useRef(false);

  useEffect(() => () => setAdminFormDirty(false), [setAdminFormDirty]);

  useEffect(() => {
    if (restoredDraftRef.current) return;
    restoredDraftRef.current = true;
    try {
      const draft = JSON.parse(localStorage.getItem(SETTINGS_FORM_DRAFT_KEY) || 'null');
      if (!draft || typeof draft !== 'object') return;
      const { baseSettings, ...draftValues } = draft;
      const recovered = { ...settings, ...draftValues };
      setForm(recovered);
      setEditBase(baseSettings || settings);
      setAdminFormDirty(JSON.stringify(recovered) !== JSON.stringify(settings));
      setNotice('Recovered unsaved store settings from this browser.');
    } catch (error) {
      console.error('Could not restore the saved settings form.', error);
    }
  }, [setAdminFormDirty, settings]);

  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(settings)) {
      try {
        localStorage.removeItem(SETTINGS_FORM_DRAFT_KEY);
      } catch (error) {
        console.error('Could not clear the settings form draft.', error);
      }
      return;
    }
    try {
      localStorage.setItem(SETTINGS_FORM_DRAFT_KEY, JSON.stringify({ ...form, baseSettings: editBase }));
    } catch (error) {
      console.error('Could not preserve the settings form draft.', error);
    }
  }, [editBase, form, settings]);

  const set = (key) => (e) => {
    const value = e.target.value;
    const next = { ...form, [key]: value };
    setForm(next);
    setAdminFormDirty(JSON.stringify(next) !== JSON.stringify(settings));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const changedFields = Object.keys(form).filter((key) => JSON.stringify(form[key]) !== JSON.stringify(editBase[key]));
    const conflicts = changedFields.filter((key) => JSON.stringify(settings[key]) !== JSON.stringify(editBase[key]));
    if (conflicts.length) {
      setSaved(false);
      setNotice(`These settings changed in another admin session: ${conflicts.join(', ')}. Your draft is preserved; reload and reapply your changes.`);
      return;
    }
    setSavingSettings(true);
    const patch = Object.fromEntries(changedFields.map((key) => [key, form[key]]));
    const result = await updateSettings(patch);
    setSavingSettings(false);
    if (!result) {
      setSaved(false);
      setNotice('Settings were not saved to the database. Your form values are still here; retry after resolving the shared-store error.');
      return;
    }
    setAdminFormDirty(false);
    setForm(result);
    setEditBase(result);
    try {
      localStorage.removeItem(SETTINGS_FORM_DRAFT_KEY);
    } catch (error) {
      console.error('Could not clear the settings form draft.', error);
    }
    setNotice('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRemoveAdmin = async (email) => {
    if (!window.confirm(`Remove admin access for ${email}?`)) return;
    setRemovingAdmin(email);
    const result = await removeAdmin(email);
    setRemovingAdmin('');
    setNotice(result.ok ? `Admin access removed for ${email}.` : `Could not remove admin access: ${result.error}`);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const clean = newAdmin.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setNotice('Please enter a valid email address.');
      return;
    }
    if (admins.some((a) => a.email === clean)) {
      setNotice('This email already has admin access.');
      return;
    }
    const result = await addAdmin({ email: clean });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNewAdmin('');
    setNotice(`Invitation created for ${clean}. Share invite code: ${result.inviteCode}`);
  };

  return (
    <div>
      <PageHeader
        title="Manage Settings"
        subtitle="Store configuration and admin access"
        action={isMaster && <Button to="/admin/login" variant="secondary" size="sm"><Crown size={15} /> Admin Management</Button>}
      />

      <form onSubmit={handleSave} className="rounded-xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">
          Store Settings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store Name">
            <input value={form.storeName} onChange={set('storeName')} className={inputCls} />
          </Field>
          <Field label="Support Email">
            <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={set('phone')} className={inputCls} />
          </Field>
          <Field label="WhatsApp Number (with country code)">
            <input value={form.whatsapp} onChange={set('whatsapp')} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Store Address">
              <textarea rows="2" value={form.address} onChange={set('address')} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Announcement Banner (leave empty to hide)">
              <input
                value={form.announcement}
                onChange={set('announcement')}
                className={inputCls}
                placeholder="e.g. Festive Sale: Up to 25% off on all laptops!"
              />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={savingSettings}>
            <Save size={16} />
            {savingSettings ? 'Saving…' : 'Save Settings'}
          </Button>
          {saved && (
            <span role="status" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={16} />
              Saved!
            </span>
          )}
        </div>
      </form>

      {/* Admin access management */}
      <div className="mt-6 rounded-xl bg-white p-6 shadow-card">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
          Admin Access
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Give other users admin controls by adding their email address.
        </p>
        <form onSubmit={handleAddAdmin} className="mt-4 flex gap-2">
          <label htmlFor="settings-new-admin" className="sr-only">
            New admin email
          </label>
          <input
            id="settings-new-admin"
            type="email"
            required
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="user@example.com"
            className={inputCls}
          />
          <Button type="submit" variant="secondary" size="md" className="shrink-0">
            <UserPlus size={15} />
            Give Access
          </Button>
        </form>
        {notice && (
          <p role="status" className="mt-2 rounded-lg bg-secondary/5 px-3 py-2 text-xs font-medium text-secondary">
            {notice}
          </p>
        )}
        <ul className="mt-5 space-y-2">
          {admins.map((a) => (
            <li
              key={a.email}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {a.master && <Crown size={14} className="shrink-0 text-accent-dark" />}
                <span className="truncate text-sm font-medium text-slate-700">{a.email}</span>
                {a.master && <span className="shrink-0 text-[10px] font-bold uppercase text-accent-dark">Master</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-400">{a.addedAt}</span>
                  <StatusBadge status={a.status || 'Active'} />
                {!a.master && (
                  <button
                    type="button"
                  onClick={() => handleRemoveAdmin(a.email)}
                  disabled={removingAdmin === a.email}
                  aria-label={`Remove admin access for ${a.email}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
