import { useState } from 'react';
import { CheckCircle2, KeyRound, Save } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import Button from '../../components/common/Button';
import { Field, PageHeader, inputCls } from '../../components/admin/AdminForm';

export default function AdminChangePassword() {
  const { changeAdminPassword } = useAdmin();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setError('');
    setSaved(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    const result = changeAdminPassword(form.currentPassword, form.newPassword);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setSaved(true);
  };

  return (
    <div>
      <PageHeader title="Change Password" subtitle="Update your admin sign-in password at any time" />
      <form onSubmit={handleSubmit} className="max-w-xl rounded-xl bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2 text-primary">
          <KeyRound size={18} />
          <h2 className="text-sm font-bold uppercase tracking-wider">Admin Password</h2>
        </div>
        <div className="space-y-4">
          <Field label="Current Password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={set('currentPassword')}
              className={inputCls}
            />
          </Field>
          <Field label="New Password">
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.newPassword}
              onChange={set('newPassword')}
              className={inputCls}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Confirm New Password">
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              className={inputCls}
              placeholder="Enter the new password again"
            />
          </Field>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
        {saved && (
          <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={16} />
            Password updated successfully.
          </p>
        )}
        <div className="mt-5">
          <Button type="submit" variant="primary">
            <Save size={16} />
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}
