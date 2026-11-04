import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth, hasRole } from '../lib/auth.jsx';
import { Logo, Field, Alert, Spinner } from '../components/ui.jsx';

function Shell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="seigaiha relative hidden overflow-hidden p-10 text-washi md:flex md:flex-col md:justify-between">
        <Link to="/">
          <Logo light />
        </Link>
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-beni" aria-hidden />
        <div className="relative max-w-sm">
          <div className="font-display text-4xl font-bold leading-tight">いらっしゃいませ</div>
          <p className="mt-3 text-washi/70">Welcome to Ema. Your loyalty is rewarded from your very first visit.</p>
        </div>
        <div className="relative text-xs text-washi/40">Ema Japanese Cuisine · The Woodlands, TX</div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="md:hidden">
          <Logo />
        </Link>
        <div className="m-auto w-full max-w-md py-8">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-3">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Login({ portal = 'customer', next }) {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email, password, portal } });
      setUser(r.user);
      if (r.user.role === 'customer') nav('/app');
      else nav(next === 'admin' && hasRole(r.user, 'manager') ? '/admin' : '/staff');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  const isStaff = portal === 'staff';
  return (
    <Shell title={isStaff ? 'Staff sign in' : 'Welcome back'} subtitle={isStaff ? 'Employees, managers and owners' : 'Sign in to see your points and rewards.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Alert>{err}</Alert>
        <button className="btn-primary btn-lg w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Sign in'}
        </button>
      </form>
      {!isStaff && (
        <>
          <p className="mt-6 text-center text-sm text-ink-3">
            New to Ema Rewards?{' '}
            <Link to="/join" className="font-semibold text-beni hover:underline">
              Join free
            </Link>
          </p>
          <div className="mt-8 rounded-2xl border border-dashed border-washi-3 p-4 text-sm">
            <div className="eyebrow mb-1">Presentation demo</div>
            <p className="text-ink-3">Sample member account with demonstration data:</p>
            <button
              type="button"
              className="btn-outline mt-2 w-full"
              onClick={() => {
                setEmail('demo@emarewards.app');
                setPassword('demo1234');
              }}
            >
              Fill demo login
            </button>
          </div>
        </>
      )}
      {isStaff && (
        <p className="mt-6 text-center text-sm text-ink-3">
          Customer?{' '}
          <Link to="/login" className="font-semibold text-beni hover:underline">
            Sign in here
          </Link>
        </p>
      )}
    </Shell>
  );
}

export function Register() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '', birthday: '', referralCode: params.get('ref') || '', agree: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!f.agree) return setErr('Please accept the program terms.');
    setBusy(true);
    setErr('');
    try {
      const r = await api('/auth/register', { method: 'POST', body: f });
      setUser(r.user);
      nav('/app?welcome=1');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Join Ema Rewards" subtitle="Free forever. Start earning on today’s visit.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input className="input" required autoComplete="given-name" value={f.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Last name">
            <input className="input" required autoComplete="family-name" value={f.lastName} onChange={set('lastName')} />
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone (optional)">
            <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Birthday (optional)" hint="For a birthday treat">
            <input className="input" type="date" value={f.birthday} onChange={set('birthday')} />
          </Field>
        </div>
        <Field label="Referral code (optional)">
          <input className="input uppercase" value={f.referralCode} onChange={set('referralCode')} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-beni" checked={f.agree} onChange={set('agree')} />
          <span>
            I agree to the{' '}
            <Link to="/program#terms" target="_blank" className="font-semibold text-ink underline">
              Ema Rewards program terms
            </Link>
            . We never sell your information.
          </span>
        </label>
        <Alert>{err}</Alert>
        <button className="btn-beni btn-lg w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Create my account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-3">
        Already a member?{' '}
        <Link to="/login" className="font-semibold text-beni hover:underline">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
