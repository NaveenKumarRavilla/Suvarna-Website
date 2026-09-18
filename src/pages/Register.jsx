import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, User, Mail, Phone, Lock, Eye, EyeOff, Chrome } from 'lucide-react';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

const inputWrap =
  'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-secondary focus-within:bg-white focus-within:ring-2 focus-within:ring-secondary/20';
const inputCls = 'w-full bg-transparent py-2.5 text-sm text-slate-700 outline-none';

export default function Register() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.name.value;
    const email = form.email.value;
    const phone = form.phone.value;
    const password = form.password.value;
    const confirm = form.confirm.value;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const res = register({ name, email, phone, password });
    if (res.ok) navigate('/account');
    else setError(res.error);
  };

  const handleGoogle = () => {
    loginWithGoogle();
    navigate('/account');
  };

  return (
    <div className="mx-auto flex max-w-8xl items-center justify-center px-4 py-14">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-accent">
            <Cpu size={26} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-primary">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Join Suvarna IT Enterprises today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="reg-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Full Name
            </label>
            <div className={inputWrap}>
              <User size={16} className="shrink-0 text-slate-400" />
              <input id="reg-name" name="name" required placeholder="Your full name" className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Email
            </label>
            <div className={inputWrap}>
              <Mail size={16} className="shrink-0 text-slate-400" />
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                onChange={() => setError('')}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Mobile Number
            </label>
            <div className={inputWrap}>
              <Phone size={16} className="shrink-0 text-slate-400" />
              <input
                id="reg-phone"
                name="phone"
                type="tel"
                required
                pattern="[+0-9\\- ]{10,15}"
                placeholder="+91 98765 43210"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Password
            </label>
            <div className={inputWrap}>
              <Lock size={16} className="shrink-0 text-slate-400" />
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
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
          <div>
            <label htmlFor="reg-confirm" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Confirm Password
            </label>
            <div className={inputWrap}>
              <Lock size={16} className="shrink-0 text-slate-400" />
              <input
                id="reg-confirm"
                name="confirm"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Re-enter your password"
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full">
            Register
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
          Sign up with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-secondary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
