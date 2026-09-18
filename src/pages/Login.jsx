import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

const inputWrap =
  'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-secondary focus-within:bg-white focus-within:ring-2 focus-within:ring-secondary/20';
const inputCls = 'w-full bg-transparent py-2.5 text-sm text-slate-700 outline-none';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const res = login(identifier, password);
    if (res.ok) navigate('/');
    else setError(res.error);
  };

  const handleGoogle = () => {
    loginWithGoogle();
    navigate('/');
  };

  return (
    <div className="mx-auto flex max-w-8xl items-center justify-center px-4 py-14">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-accent">
            <Cpu size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-primary">Welcome Back</h1>
          <p className="mt-1 text-sm text-slate-500">
            Login to your Suvarna IT Enterprises account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Email or Mobile Number
            </label>
            <div className={inputWrap}>
              <Mail size={16} className="shrink-0 text-slate-400" />
              <input
                id="login-email"
                type="text"
                required
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                placeholder="you@example.com or +91 98765 43210"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Password
            </label>
            <div className={inputWrap}>
              <Lock size={16} className="shrink-0 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="shrink-0 text-slate-400 transition hover:text-secondary"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" className="h-3.5 w-3.5 accent-secondary" />
              Remember me
            </label>
            <Link to="/login" className="font-semibold text-secondary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Login
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          OR
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGoogle}
        >
          <Chrome size={18} />
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate-500">
          New to Suvarna?{' '}
          <Link to="/register" className="font-semibold text-secondary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
