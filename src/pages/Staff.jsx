import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { api, uuid } from '../lib/api.js';
import { useAuth, hasRole } from '../lib/auth.jsx';
import { Login } from './Auth.jsx';
import { Logo, PageLoader, TierBadge, Alert, Spinner, Modal, Field, useToast } from '../components/ui.jsx';
import { QrScanner } from '../components/Qr.jsx';
import { fmtTime } from '../../shared/engine.js';
import { money, pts, dateTime, ago } from '../lib/format.js';

export default function StaffApp() {
  const { user } = useAuth();
  if (user === undefined) return <PageLoader />;
  if (!user || !hasRole(user, 'employee')) return <Login portal="staff" />;
  return (
    <Routes>
      <Route path="*" element={<StaffPortal />} />
    </Routes>
  );
}

function StaffPortal() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('purchase');
  const [presetCode, setPresetCode] = useState(null);
  return (
    <div className="min-h-screen bg-ink text-washi">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo light size="sm" />
            <span className="chip bg-beni text-white">STAFF</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-washi/60 sm:inline">{user.firstName} · {user.role}</span>
            {hasRole(user, 'manager') && <Link to="/admin" className="rounded-lg px-3 py-1.5 font-semibold text-washi/80 hover:bg-white/10">Dashboard</Link>}
            <button className="rounded-lg px-3 py-1.5 font-semibold text-washi/80 hover:bg-white/10" onClick={async () => { await logout(); nav('/staff'); }}>Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1">
          {[['purchase', 'Record purchase'], ['verify', 'Verify reward'], ['recent', 'My recent']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-xl py-2.5 text-sm font-semibold transition ${tab === k ? 'bg-washi text-ink' : 'text-washi/70 hover:text-washi'}`}>{l}</button>
          ))}
        </div>
        <div className="mt-4">
          {tab === 'purchase' && <PurchaseFlow onVoucherScanned={(c) => { setPresetCode(c); setTab('verify'); }} />}
          {tab === 'verify' && <VerifyFlow preset={presetCode} clearPreset={() => setPresetCode(null)} />}
          {tab === 'recent' && <Recent />}
        </div>
      </div>
    </div>
  );
}

function DarkCard({ children, className = '' }) {
  return <div className={`rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 ${className}`}>{children}</div>;
}

function ScanStep({ onToken, onManual, busy, err, placeholder = 'EMA-XXXX-XXXX', manualLabel = 'Member ID' }) {
  const [manual, setManual] = useState('');
  return (
    <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
      <DarkCard>
        <div className="mb-3 text-sm font-semibold text-washi/80">Point the camera at the guest’s QR code</div>
        <QrScanner onResult={onToken} paused={busy} />
      </DarkCard>
      <DarkCard className="flex flex-col justify-between">
        <div>
          <div className="text-sm font-semibold text-washi/80">Camera not working?</div>
          <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onManual(manual.trim().toUpperCase()); }}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-washi/50">{manualLabel}</label>
            <input className="input bg-white text-ink uppercase" placeholder={placeholder} value={manual} onChange={(e) => setManual(e.target.value)} />
            <button className="btn w-full bg-washi text-ink hover:bg-white" disabled={busy}>{busy ? <Spinner /> : 'Look up'}</button>
          </form>
          {manualLabel === 'Member ID' && <p className="mt-2 text-xs text-washi/40">Manual lookups are recorded in the audit log.</p>}
        </div>
        {err && <div className="mt-4 rounded-xl bg-beni/20 px-3 py-2 text-sm text-[#ffb4a8]">{err}</div>}
      </DarkCard>
    </div>
  );
}

function PurchaseFlow({ onVoucherScanned }) {
  const toast = useToast();
  const [step, setStep] = useState('scan');
  const [customer, setCustomer] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ subtotal: '', tax: '', tip: '', receiptNo: '' });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [dupPrompt, setDupPrompt] = useState(null);
  const keyRef = useRef(uuid());
  const amountRef = useRef(null);

  const identify = async (body) => {
    setBusy(true);
    setErr('');
    try {
      const r = await api('/staff/identify', { method: 'POST', body });
      setCustomer(r.customer);
      keyRef.current = uuid();
      setForm({ subtotal: '', tax: '', tip: '', receiptNo: '' });
      setStep('amount');
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onToken = (t) => {
    if (busy || step !== 'scan') return;
    if (/^R-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(t)) return onVoucherScanned(t.toUpperCase());
    identify({ token: t });
  };

  useEffect(() => {
    if (step === 'amount') setTimeout(() => amountRef.current?.focus(), 50);
  }, [step]);

  // live preview
  useEffect(() => {
    if (step !== 'amount' || !customer) return;
    const sub = Number(form.subtotal);
    if (!(sub > 0)) return setPreview(null);
    const t = setTimeout(async () => {
      try {
        const r = await api('/staff/preview', { method: 'POST', body: { customerId: customer.id, subtotal: sub, tax: Number(form.tax) || 0, tip: Number(form.tip) || 0 } });
        setPreview(r);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [form.subtotal, form.tax, form.tip, customer, step]);

  const submit = async (confirmDuplicate = false) => {
    setBusy(true);
    setErr('');
    try {
      const r = await api('/staff/purchase', { method: 'POST', body: { customerId: customer.id, subtotal: Number(form.subtotal), tax: Number(form.tax) || 0, tip: Number(form.tip) || 0, receiptNo: form.receiptNo, idempotencyKey: keyRef.current, confirmDuplicate } });
      setResult(r);
      setStep('done');
      setDupPrompt(null);
    } catch (e) {
      if (e.data?.possibleDuplicate) setDupPrompt(e.message);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const redeemVoucher = async (code) => {
    try {
      await api('/staff/voucher/use', { method: 'POST', body: { code, customerId: customer.id } });
      toast(`Reward ${code} redeemed`);
      setCustomer((c) => ({ ...c, vouchers: c.vouchers.filter((v) => v.code !== code) }));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const reset = () => {
    setStep('scan');
    setCustomer(null);
    setResult(null);
    setPreview(null);
    setErr('');
  };

  if (step === 'scan') return <ScanStep onToken={onToken} onManual={(id) => identify({ memberId: id })} busy={busy} err={err} />;

  if (step === 'done' && result) {
    const c = result.calc;
    return (
      <div className="space-y-4">
        <DarkCard className="text-center">
          <div className="mx-auto flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-matcha text-3xl">✓</div>
          <div className="mt-3 text-sm text-washi/60">{result.duplicate ? 'Already recorded (duplicate submission ignored)' : 'Points posted to'} {customer.name}</div>
          <div className="font-display text-5xl font-bold">+{pts(result.transaction.total_points)}</div>
          <div className="mt-1 text-sm text-washi/60">New balance {pts(result.balance ?? 0)} pts</div>
        </DarkCard>
        {c && (
          <DarkCard>
            <Row l={`Eligible amount (${money(c.eligible)}) × ${c.rate} pts`} r={pts(c.basePoints)} />
            {c.offpeakBonus > 0 && <Row l={`Off-peak bonus ${c.offpeakMultiplier}×`} r={`+${pts(c.offpeakBonus)}`} />}
            {c.promoBonus > 0 && <Row l={`Promotion ${c.promoMultiplier}×`} r={`+${pts(c.promoBonus)}`} />}
            <Row l="Total" r={pts(c.totalPoints)} bold />
            {c.notes?.map((n) => <div key={n} className="mt-1 text-xs text-washi/50">• {n}</div>)}
          </DarkCard>
        )}
        {(result.milestones?.length > 0 || result.tierChange || result.streaks?.length > 0) && (
          <DarkCard className="space-y-1 text-sm">
            {result.tierChange?.up && <div>🎉 Guest reached <b>{result.tierChange.tier.name}</b>. Congratulate them!</div>}
            {result.milestones?.map((m) => <div key={m.key}>🎁 Milestone unlocked: <b>{m.label}</b></div>)}
            {result.streaks?.map((s) => <div key={s.visits}>🔥 {s.visits}-visit streak: +{s.points} pts</div>)}
          </DarkCard>
        )}
        <button className="btn-beni btn-lg w-full" onClick={reset}>Next guest</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DarkCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-washi/50">Member</div>
            <div className="font-display text-2xl font-bold">{customer.name}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-washi/60"><TierBadge tier={customer.tier} /> {customer.tier.rate} pts/$ · {pts(customer.balance)} pts · {customer.visits} visits</div>
          </div>
          <button className="rounded-lg px-3 py-1.5 text-sm text-washi/70 hover:bg-white/10" onClick={reset}>Cancel</button>
        </div>
        {customer.offpeakNow ? (
          <div className="mt-3 rounded-xl bg-matcha/30 px-3 py-2 text-sm">🌙 Off-peak window active: <b>{customer.offpeakNow.multiplier}×</b> until {fmtTime(customer.offpeakNow.end)}</div>
        ) : (
          <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-washi/60">Standard hours: no off-peak bonus right now</div>
        )}
        {customer.vouchers.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-washi/50">Rewards available to use</div>
            {customer.vouchers.map((v) => (
              <div key={v.code} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span>{v.reward_name} <span className="font-mono text-xs text-washi/40">{v.code}</span></span>
                <button className="btn bg-washi px-3 py-1.5 text-ink" onClick={() => redeemVoucher(v.code)}>Redeem now</button>
              </div>
            ))}
          </div>
        )}
      </DarkCard>

      <DarkCard>
        <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-washi/50">Pre-tax subtotal from verified receipt</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl text-ink-3">$</span>
            <input ref={amountRef} className="input h-16 bg-white pl-10 font-display text-3xl text-ink" inputMode="decimal" type="number" step="0.01" min="0" placeholder="0.00" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-washi/50">Check / receipt #</label><input className="input bg-white text-ink" value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })} placeholder="1042" /></div>
            <div><label className="text-xs text-washi/50">Tax</label><input className="input bg-white text-ink" inputMode="decimal" type="number" step="0.01" min="0" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
            <div><label className="text-xs text-washi/50">Tip</label><input className="input bg-white text-ink" inputMode="decimal" type="number" step="0.01" min="0" value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })} /></div>
          </div>
          {preview && (
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              {preview.calc.qualifies ? (
                <>
                  <Row l={`${money(preview.calc.eligible)} × ${preview.calc.rate}`} r={pts(preview.calc.basePoints)} />
                  {preview.calc.offpeakBonus > 0 && <Row l={`Off-peak ${preview.calc.offpeakMultiplier}×`} r={`+${pts(preview.calc.offpeakBonus)}`} />}
                  {preview.calc.promoBonus > 0 && <Row l={`${preview.campaign?.name} ${preview.calc.promoMultiplier}×`} r={`+${pts(preview.calc.promoBonus)}`} />}
                  <Row l="Guest will earn" r={`${pts(preview.calc.totalPoints)} pts`} bold />
                  {preview.calc.notes.map((n) => <div key={n} className="text-xs text-washi/50">• {n}</div>)}
                </>
              ) : (
                <div className="text-[#ffb4a8]">{preview.calc.notes[0]}</div>
              )}
            </div>
          )}
          {err && <div className="rounded-xl bg-beni/20 px-3 py-2 text-sm text-[#ffb4a8]">{err}</div>}
          <button className="btn-beni btn-lg w-full" disabled={busy || !(Number(form.subtotal) > 0)}>{busy ? <Spinner /> : 'Confirm & post points'}</button>
          <p className="text-center text-xs text-washi/40">Tax and tips do not earn points. Each receipt number can be posted only once.</p>
        </form>
      </DarkCard>
      <Modal open={!!dupPrompt} onClose={() => setDupPrompt(null)} title="Possible duplicate">
        <div className="text-ink">
          <p className="text-sm">{dupPrompt}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-outline" onClick={() => setDupPrompt(null)}>Cancel</button>
            <button className="btn-beni" onClick={() => submit(true)}>Yes, separate check</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ l, r, bold }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${bold ? 'mt-1 border-t border-white/10 pt-2 font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-washi/70'}>{l}</span>
      <span>{r}</span>
    </div>
  );
}

function VerifyFlow({ preset, clearPreset }) {
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lookup = async (code) => {
    setBusy(true);
    setErr('');
    setDone(false);
    try {
      const r = await api('/staff/voucher/lookup', { method: 'POST', body: { code } });
      setV(r.voucher);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (preset) {
      lookup(preset);
      clearPreset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);
  const use = async () => {
    setBusy(true);
    setErr('');
    try {
      await api('/staff/voucher/use', { method: 'POST', body: { code: v.code } });
      setDone(true);
      setV({ ...v, status: 'used' });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!v) return <ScanStep onToken={(t) => !busy && lookup(t)} onManual={lookup} busy={busy} err={err} placeholder="R-XXXX-XXXX" manualLabel="Reward code" />;
  const ok = v.status === 'issued';
  return (
    <div className="space-y-4">
      <DarkCard className="text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${done ? 'animate-pop bg-matcha' : ok ? 'bg-kin' : 'bg-beni'}`}>{done ? '✓' : ok ? '🎁' : '✕'}</div>
        <div className="mt-3 font-display text-2xl font-bold">{v.reward_name}</div>
        <div className="text-sm text-washi/60">{v.member} · {v.memberId}</div>
        <div className="mt-1 font-mono text-sm text-washi/50">{v.code}</div>
        <div className="mt-3 text-sm">
          {done ? 'Redeemed. Serve the item at no charge.' : ok ? `Valid until ${dateTime(v.expires_at)}` : `This reward is ${v.status}${v.used_at ? ` (${ago(v.used_at)})` : ''} and cannot be used.`}
        </div>
      </DarkCard>
      {err && <Alert>{err}</Alert>}
      {ok && !done && <button className="btn-beni btn-lg w-full" onClick={use} disabled={busy}>{busy ? <Spinner /> : 'Mark as redeemed'}</button>}
      <button className="btn btn-lg w-full bg-white/10 text-washi hover:bg-white/20" onClick={() => { setV(null); setDone(false); setErr(''); }}>Scan another</button>
    </div>
  );
}

function Recent() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api('/staff/recent').then((r) => setRows(r.rows));
  }, []);
  if (!rows) return <PageLoader />;
  if (!rows.length) return <DarkCard className="text-center text-washi/60">No transactions recorded by you yet.</DarkCard>;
  return (
    <DarkCard className="divide-y divide-white/10 p-0">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <div className="font-semibold">{r.first_name} {r.last_name[0]}. <span className="font-mono text-xs text-washi/40">{r.member_id}</span></div>
            <div className="text-xs text-washi/50">{dateTime(r.created_at)}{r.receipt_no ? ` · #${r.receipt_no}` : ''}{r.status === 'reversed' ? ' · REVERSED' : ''}</div>
          </div>
          <div className="text-right">
            <div>{money(r.subtotal)}</div>
            <div className="text-xs text-matcha-soft">+{pts(r.total_points)}{r.offpeak_bonus ? ' 🌙' : ''}</div>
          </div>
        </div>
      ))}
    </DarkCard>
  );
}

export { Field };
