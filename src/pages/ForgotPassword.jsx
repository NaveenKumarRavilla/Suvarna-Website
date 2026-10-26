import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Chrome, KeyRound, Mail } from 'lucide-react';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-secondary focus:bg-white focus:ring-2 focus:ring-secondary/20';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogle, logout, setPasswordForCurrentUser, googleReady, googleLoadError } = useAuth();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGoogleVerification = async () => {
    const requestedEmail = normalizeEmail(email);
    if (!requestedEmail) {
      setError('Enter the email address for the account you want to recover.');
      return;
    }

    setError('');
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (normalizeEmail(result.user.email) !== requestedEmail) {
      logout();
      setError(`The Google account ${result.user.email} does not match the email you entered. Sign out and choose the correct Google account.`);
      return;
    }

    setVerifiedEmail(requestedEmail);
    setError('');
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const result = setPasswordForCurrentUser(password);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/account', { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-8xl items-center justify-center px-4 py-14">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-accent">
            <KeyRound size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-primary">Set or Reset Password</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Verify ownership with Google using the same email as your account, then choose a password for email login.
          </p>
        </div>

        {!verifiedEmail ? (
          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="recovery-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Account Email
              </label>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 focus-within:border-secondary focus-within:bg-white focus-within:ring-2 focus-within:ring-secondary/20">
                <Mail size={16} className="shrink-0 text-slate-400" />
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  placeholder="you@example.com"
                  className="w-full bg-transparent py-2.5 text-sm text-slate-700 outline-none"
                />
              </div>
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGoogleVerification}
              disabled={googleLoading || (!googleReady && !googleLoadError)}
            >
              <Chrome size={18} />
              {googleLoading ? 'Verifying with Google...' : googleReady ? 'Verify with Google' : googleLoadError ? 'Google sign-in unavailable' : 'Loading Google sign-in...'}
            </Button>
            {googleLoadError && <p role="alert" className="text-xs font-medium text-red-600">{googleLoadError}</p>}
            <p className="text-xs leading-relaxed text-slate-500">
              This app does not send password reset emails. If the account email is not a Google account you can verify, contact the store administrator for help.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSetPassword} className="mt-7 space-y-4">
            <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              Google verified {verifiedEmail}. Your new password will also work for this account.
            </p>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                className={inputCls}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError('');
                }}
                className={inputCls}
                placeholder="Enter the password again"
              />
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Saving Password...' : 'Save Password'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered your password?{' '}
          <Link to="/login" className="font-semibold text-secondary hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
