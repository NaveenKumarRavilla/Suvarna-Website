import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Cpu, KeyRound, UserPlus, Trash2, Crown, LayoutDashboard, Store, Mail } from 'lucide-react';
import { ADMIN_PERMISSIONS, MASTER_ADMIN, MASTER_ADMIN_PASSWORD, useAdmin } from '../context/AdminContext';
import Button from '../components/common/Button';
import { inputCls, labelCls, StatusBadge } from '../components/admin/AdminForm';

export default function AdminLogin() {
  const { login, isAdmin, isMaster, currentUser, admins, addAdmin, removeAdmin, updateAdmin, completeInvitation } = useAdmin();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [newAdmin, setNewAdmin] = useState('');
  const [newRole, setNewRole] = useState('Editor');
  const [newPermissions, setNewPermissions] = useState(['products', 'offers']);
  const [inviteNotice, setInviteNotice] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const result = login(email, password);
    if (result.ok) navigate('/admin');
    else setError(result.error);
  };

  const handleInvitation = (e) => {
    e.preventDefault();
    const result = completeInvitation({ email, inviteCode, password, name });
    if (result.ok) {
      setMode('login');
      setPassword('');
      setError('Invitation accepted. Log in with your new password.');
    } else setError(result.error);
  };

  const togglePermission = (permission) => {
    setNewPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const handleAddAdmin = (e) => {
    e.preventDefault();
    const clean = newAdmin.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setInviteNotice('Please enter a valid email address.');
      return;
    }
    if (admins.some((admin) => admin.email === clean)) {
      setInviteNotice('This email already has admin access.');
      return;
    }
    const code = addAdmin({ email: clean, role: newRole, permissions: newPermissions });
    setNewAdmin('');
    setInviteNotice(`Invitation created for ${clean}. Share invite code: ${code}`);
  };

  if (isAdmin) {
    return (
      <div className="mx-auto flex max-w-8xl items-start justify-center px-4 py-10">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck size={22} /></span><div><h1 className="text-lg font-extrabold text-primary">Admin Access Granted</h1><p className="text-sm text-slate-500">{currentUser}</p></div></div>
            <div className="flex gap-2"><Button to="/admin" variant="primary" size="sm"><LayoutDashboard size={15} /> Dashboard</Button><Button to="/" variant="outline" size="sm"><Store size={15} /> Storefront</Button></div>
          </div>

          {isMaster ? (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2"><Crown size={17} className="text-accent-dark" /><h2 className="text-sm font-bold uppercase tracking-wider text-primary">Admin Management</h2></div>
              <p className="mt-1 text-xs text-slate-500">Create invitations and assign exactly which controls each admin can access.</p>
              <form onSubmit={handleAddAdmin} className="mt-4 rounded-xl bg-surface p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
                  <div><label htmlFor="new-admin-email" className={labelCls}>Invite Email</label><input id="new-admin-email" type="email" required value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} placeholder="manager@example.com" className={inputCls} /></div>
                  <div><label htmlFor="new-admin-role" className={labelCls}>Role</label><select id="new-admin-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputCls}><option>Editor</option><option>Manager</option><option>Support</option></select></div>
                  <div className="self-end"><Button type="submit" variant="secondary" size="md"><UserPlus size={15} /> Create Invitation</Button></div>
                </div>
                <div className="mt-4"><p className={labelCls}>Assign Permissions</p><div className="flex flex-wrap gap-x-4 gap-y-2">{ADMIN_PERMISSIONS.map((permission) => <label key={permission.id} className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={newPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="h-4 w-4 accent-secondary" />{permission.label}</label>)}</div></div>
              </form>
              {inviteNotice && <p role="status" className="mt-2 rounded-lg bg-secondary/5 px-3 py-2 text-xs font-medium text-secondary">{inviteNotice}</p>}
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Permissions</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{admins.map((admin) => <tr key={admin.email}><td className="px-4 py-3"><span className="flex items-center gap-2 font-semibold text-primary">{admin.master && <Crown size={14} className="text-accent-dark" />}{admin.email}</span><span className="text-xs text-slate-400">{admin.name}</span></td><td className="px-4 py-3">{admin.master ? <span className="text-slate-600">Master Admin</span> : <select value={admin.role} onChange={(e) => updateAdmin(admin.email, { role: e.target.value })} className="rounded border border-slate-200 px-2 py-1 text-xs"><option>Editor</option><option>Manager</option><option>Support</option></select>}</td><td className="px-4 py-3"><StatusBadge status={admin.status} /></td><td className="max-w-[260px] px-4 py-3 text-xs text-slate-500">{admin.master ? 'All controls' : <div className="flex max-w-[260px] flex-wrap gap-x-3 gap-y-1">{ADMIN_PERMISSIONS.map((permission) => <label key={permission.id} className="flex items-center gap-1"><input type="checkbox" checked={admin.permissions.includes(permission.id)} onChange={() => updateAdmin(admin.email, { permissions: admin.permissions.includes(permission.id) ? admin.permissions.filter((item) => item !== permission.id) : [...admin.permissions, permission.id] })} className="h-3 w-3 accent-secondary" />{permission.label.replace('Manage ', '')}</label>)}</div>}</td><td className="px-4 py-3">{!admin.master && <button type="button" onClick={() => removeAdmin(admin.email)} aria-label={`Remove admin access for ${admin.email}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}</td></tr>)}</tbody></table>
              </div>
            </div>
          ) : <p className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500">Your admin access is managed by the master admin.</p>}
        </div>
      </div>
    );
  }

  const isInvitation = mode === 'invite';
  return (
    <div className="mx-auto flex max-w-8xl items-center justify-center px-4 py-12"><div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
      <div className="flex flex-col items-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-accent"><Cpu size={26} /></span><h1 className="mt-4 text-2xl font-extrabold text-primary">{isInvitation ? 'Accept Admin Invitation' : 'Admin Login'}</h1><p className="mt-1 text-sm text-slate-500">{isInvitation ? 'Create your password to activate access' : 'Authorized admin users only'}</p></div>
      <form onSubmit={isInvitation ? handleInvitation : handleLogin} className="mt-7 space-y-4">
        {isInvitation && <div><label htmlFor="admin-name" className={labelCls}>Your Name</label><input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Admin name" /></div>}
        <div><label htmlFor="admin-email" className={labelCls}>Admin Email</label><div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input id="admin-email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="admin@example.com" className={`${inputCls} pl-9`} /></div></div>
        {isInvitation && <div><label htmlFor="invite-code" className={labelCls}>Invitation Code</label><input id="invite-code" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="SIE-ABC123" className={inputCls} /></div>}
        <div><label htmlFor="admin-password" className={labelCls}>{isInvitation ? 'Create Password' : 'Password'}</label><div className="relative"><KeyRound size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input id="admin-password" type="password" required minLength={8} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Minimum 8 characters" className={`${inputCls} pl-9`} /></div></div>
        {error && <p role="alert" className={`rounded-lg px-3 py-2 text-xs font-medium ${error.includes('accepted') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full"><ShieldCheck size={16} />{isInvitation ? 'Create Password & Activate' : 'Admin Login'}</Button>
      </form>
      <button type="button" onClick={() => { setMode(isInvitation ? 'login' : 'invite'); setError(''); }} className="mt-5 flex w-full items-center justify-center gap-1 text-xs font-semibold text-secondary hover:underline"><UserPlus size={13} />{isInvitation ? 'Back to admin login' : 'Have an invitation? Create password'}</button>
      {!isInvitation && <p className="mt-5 text-center text-xs text-slate-400">Master admin: <span className="font-semibold text-slate-500">{MASTER_ADMIN}</span><br />Initial demo password: <span className="font-semibold text-slate-500">{MASTER_ADMIN_PASSWORD}</span></p>}
    </div></div>
  );
}
