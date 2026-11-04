import { useEffect, useState, createContext, useContext, useCallback } from 'react';

export function Logo({ light = false, size = 'md' }) {
  const s = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold ${s} ${light ? 'text-washi' : 'text-ink'}`}>
      <svg viewBox="0 0 40 40" className={size === 'lg' ? 'h-10 w-10' : 'h-7 w-7'} aria-hidden>
        <circle cx="20" cy="20" r="15" fill="none" stroke="#b23a2b" strokeWidth="4" strokeDasharray="78 16" strokeLinecap="round" transform="rotate(-60 20 20)" />
        <circle cx="20" cy="20" r="4" fill={light ? '#f5efe4' : '#1d1917'} />
      </svg>
      <span>
        Ema <span className="font-sans text-[0.62em] font-semibold uppercase tracking-[0.22em] align-middle opacity-70">Rewards</span>
      </span>
    </span>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-3">
      <Spinner />
    </div>
  );
}

export function Progress({ value, className = '', color = 'bg-beni', height = 'h-2.5', animate = true }) {
  const [w, setW] = useState(animate ? 0 : value);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-washi-2 ${height} ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`${height} rounded-full ${color} transition-[width] duration-1000 ease-out`} style={{ width: `${Math.max(0, Math.min(1, w)) * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${accent || ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function TierBadge({ tier, size = 'sm' }) {
  const key = tier?.key || tier;
  const name = tier?.name || (key ? key[0].toUpperCase() + key.slice(1) : '');
  const cls = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]';
  return <span className={`tier-${key} inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${cls}`}>◆ {name}</span>;
}

export function Empty({ title, children, icon = '◌' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-washi-3 px-6 py-10 text-center">
      <div className="text-3xl text-ink-4">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-lift animate-rise sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button className="btn-ghost -mr-2 -mt-1 px-2 py-1" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const c = kind === 'error' ? 'bg-beni-soft text-beni-dark border-beni/20' : kind === 'success' ? 'bg-matcha-soft text-matcha border-matcha/20' : kind === 'warn' ? 'bg-kin-soft text-[#6b4f1d] border-kin/30' : 'bg-ai-soft text-ai border-ai/20';
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${c}`}>{children}</div>;
}

export function DemoBanner({ children }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-kin/40 bg-kin-soft px-3 py-2 text-xs font-medium text-[#6b4f1d]">
      <span className="chip bg-kin text-white">DEMO</span>
      <span>{children || 'Hypothetical demonstration data. Not actual restaurant results.'}</span>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-xl bg-washi-2 p-1 ${className}`}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === o.value ? 'bg-paper shadow-card text-ink' : 'text-ink-3 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-matcha' : 'bg-washi-3'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-sm font-medium">{label}</span>}
    </label>
  );
}

// ---- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto animate-rise rounded-2xl px-4 py-3 text-sm font-semibold shadow-lift ${t.kind === 'error' ? 'bg-beni text-white' : 'bg-ink text-washi'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---- celebration (milestone / tier unlock)
export function Celebration({ show, title, subtitle, onDone }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone?.(), 4200);
    return () => clearTimeout(t);
  }, [show, onDone]);
  if (!show) return null;
  const petals = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 backdrop-blur-sm" onClick={onDone}>
      {petals.map((i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-0 h-3 w-3 rounded-[60%_0_60%_0] bg-[#f2c4c9]"
          style={{ left: `${(i * 37) % 100}%`, animation: `petal ${3 + (i % 5) * 0.5}s linear ${(i % 7) * 0.25}s both` }}
        />
      ))}
      <div className="mx-6 max-w-sm animate-pop rounded-3xl bg-paper p-8 text-center shadow-lift">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-beni text-3xl text-white">🎁</div>
        <div className="font-display text-2xl font-bold">{title}</div>
        {subtitle && <div className="mt-2 text-sm text-ink-3">{subtitle}</div>}
        <button className="btn-primary mt-5 w-full" onClick={onDone}>Wonderful</button>
      </div>
    </div>
  );
}
