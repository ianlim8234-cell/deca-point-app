import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAdmin, PageHead, Panel } from './AdminApp.jsx';
import { PageLoader, TierBadge, Modal, Field, Alert, useToast, Stat, Segmented } from '../../components/ui.jsx';
import { money, money0, pts, date, dateTime, ago } from '../../lib/format.js';

export default function Customers() {
  const { data } = useAdmin();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [view, setView] = useState('frequent');
  useEffect(() => {
    const t = setTimeout(() => api(`/admin/customers?q=${encodeURIComponent(q)}`).then((r) => setRows(r.rows)), 200);
    return () => clearTimeout(t);
  }, [q]);
  const rec = data?.recognition;
  const lists = {
    frequent: { label: 'Most frequent', rows: rec?.frequent, metric: (p) => `${p.visits} visits` },
    spenders: { label: 'Top lifetime spend', rows: rec?.spenders, metric: (p) => money0(p.spend) },
    offpeak: { label: 'Off-peak champions', rows: rec?.offpeak, metric: (p) => `${p.offpeakVisits} quiet-hour visits` },
    longest: { label: 'Longest members', rows: rec?.longest, metric: (p) => `since ${date(p.memberSince)}` },
    engaged: { label: 'Engagement score', rows: rec?.engaged, metric: (p) => `score ${p.score}` },
    atRisk: { label: 'At risk', rows: rec?.atRisk, metric: (p) => `${p.daysSince} days since visit` },
  };
  const cur = lists[view];
  return (
    <>
      <PageHead eyebrow="Customer management" title="Customers">Search members, view their history, and spot loyal guests who deserve personal recognition.</PageHead>
      <Panel title="VIP customer recognition" sub="Use these lists to choose who receives Owner’s Rewards" actions={<Segmented value={view} onChange={setView} options={Object.entries(lists).map(([k, v]) => ({ value: k, label: v.label }))} className="flex-wrap" />}>
        {!cur?.rows ? <PageLoader /> : cur.rows.length === 0 ? <div className="text-sm text-ink-3">No members in this list yet.</div> : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {cur.rows.map((p, i) => (
              <Link key={p.id} to={`/admin/customers/${p.id}`} className="flex items-center gap-3 rounded-xl border border-washi-2 bg-paper p-3 hover:border-beni/40">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-washi">{i + 1}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name} {p.isDemo && <span className="chip bg-kin-soft text-[10px] text-[#6b4f1d]">demo</span>}</div>
                  <div className="text-xs text-ink-3">{p.tier} · {cur.metric(p)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="All members" actions={<input className="input w-64" placeholder="Search name, email, phone, member ID" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {!rows ? <PageLoader /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Member</th><th>Tier</th><th className="text-right">Lifetime spend</th><th className="text-right">Balance</th><th>Joined</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-washi/50">
                    <td>
                      <div className="font-semibold">{r.first_name} {r.last_name} {r.is_demo ? <span className="chip bg-kin-soft text-[10px] text-[#6b4f1d]">demo</span> : null}</div>
                      <div className="text-xs text-ink-3">{r.email} · <span className="font-mono">{r.member_id}</span></div>
                    </td>
                    <td><TierBadge tier={r.tier_key} /></td>
                    <td className="text-right">{money(r.spend)}</td>
                    <td className="text-right">{pts(r.balance)}</td>
                    <td className="whitespace-nowrap">{date(r.created_at)}</td>
                    <td><Link to={`/admin/customers/${r.id}`} className="font-semibold text-beni hover:underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { isOwner, reload: reloadAnalytics } = useAdmin();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [rev, setRev] = useState(null);
  const [reason, setReason] = useState('');
  const [adj, setAdj] = useState(false);
  const [adjF, setAdjF] = useState({ points: '', reason: '' });
  const [gift, setGift] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => api(`/admin/customers/${id}`).then(setD), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!d) return <PageLoader />;
  const p = d.profile;

  const doReverse = async () => {
    setErr('');
    try {
      await api(`/admin/transactions/${rev.id}/reverse`, { method: 'POST', body: { reason } });
      toast('Transaction reversed and logged');
      setRev(null);
      setReason('');
      load();
      reloadAnalytics();
    } catch (e) {
      setErr(e.message);
    }
  };
  const doVoid = async (v) => {
    const why = window.prompt(`Void "${v.reward_name}"${v.points_spent ? ` and refund ${v.points_spent} points` : ''}? Reason:`);
    if (!why) return;
    try {
      await api(`/admin/redemptions/${v.id}/void`, { method: 'POST', body: { reason: why } });
      toast('Reward voided');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const doAdjust = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api(`/admin/customers/${id}/adjust`, { method: 'POST', body: { points: Number(adjF.points), reason: adjF.reason } });
      toast('Points adjusted');
      setAdj(false);
      setAdjF({ points: '', reason: '' });
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  const toggleActive = async () => {
    if (!window.confirm(d.active ? 'Deactivate this account? The member will be unable to sign in or earn points.' : 'Reactivate this account?')) return;
    await api(`/admin/customers/${id}/active`, { method: 'POST', body: { active: !d.active } });
    load();
  };

  return (
    <>
      <Link to="/admin/customers" className="text-sm font-semibold text-ink-3 hover:text-ink">← All customers</Link>
      <PageHead
        eyebrow={`Member ${p.memberId}`}
        title={`${p.firstName} ${p.lastName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => setAdj(true)}>Adjust points</button>
            {isOwner && <button className="btn-beni" onClick={() => setGift(true)}>Issue Owner’s Reward</button>}
            {isOwner && <button className="btn-ghost" onClick={toggleActive}>{d.active ? 'Deactivate' : 'Reactivate'}</button>}
          </div>
        }
      >
        {p.email} · {p.phone || 'no phone'} · birthday {p.birthday || '—'} · joined {date(p.memberSince)} {p.isDemo && '· DEMO ACCOUNT'} {!d.active && '· DEACTIVATED'}
      </PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Tier" value={<TierBadge tier={d.tier} size="lg" />} sub={d.nextTier ? `${money(d.nextTier.remaining)} to ${d.nextTier.name}` : 'Top tier'} />
        <Stat label="Balance" value={pts(d.points.balance)} sub={`${pts(d.points.lifetime)} lifetime`} />
        <Stat label="Lifetime spend" value={money0(d.spend)} />
        <Stat label="Visits" value={d.visits} sub={`${d.monthVisits} this month`} />
        <Stat label="Referrals" value={d.referrals.length} sub={`code ${p.referralCode}`} />
      </div>
      <Panel title="Purchase history" sub="Reversals create an offsetting ledger entry and an audit record">
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Receipt</th><th className="text-right">Eligible</th><th className="text-right">Base</th><th className="text-right">Bonus</th><th className="text-right">Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dateTime(t.created_at)}</td>
                  <td>{t.receipt_no || '—'}</td>
                  <td className="text-right">{money(t.eligible_amount)}</td>
                  <td className="text-right">{pts(t.base_points)}</td>
                  <td className="text-right">{t.offpeak_bonus ? `+${t.offpeak_bonus} 🌙` : t.promo_bonus ? `+${t.promo_bonus} ★` : '—'}</td>
                  <td className="text-right font-semibold">{pts(t.total_points)}</td>
                  <td>{t.status === 'reversed' ? <span className="chip bg-beni-soft text-beni-dark" title={t.reversal_reason}>reversed</span> : <span className="chip bg-matcha-soft text-matcha">posted</span>}</td>
                  <td>{t.status === 'posted' && <button className="text-xs font-semibold text-beni hover:underline" onClick={() => { setErr(''); setRev(t); }}>Reverse</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Rewards & redemptions">
          <ul className="divide-y divide-washi-2 text-sm">
            {d.vouchers.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-semibold">{v.reward_name}</div>
                  <div className="text-xs text-ink-3"><span className="font-mono">{v.code}</span> · {v.source} · {v.points_spent ? `${pts(v.points_spent)} pts` : 'free'} · {date(v.issued_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip bg-washi-2">{v.status}</span>
                  {(v.status === 'issued' || v.status === 'expired') && <button className="text-xs font-semibold text-beni hover:underline" onClick={() => doVoid(v)}>Void</button>}
                </div>
              </li>
            ))}
            {!d.vouchers.length && <li className="py-2 text-ink-3">No rewards yet.</li>}
          </ul>
        </Panel>
        <Panel title="Account audit trail">
          <ul className="space-y-1.5 text-sm">
            {d.audits.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span><b>{a.action}</b> <span className="text-ink-3">{a.actor ? `by ${a.actor}` : ''}</span></span>
                <span className="shrink-0 text-xs text-ink-4">{ago(a.created_at)}</span>
              </li>
            ))}
            {!d.audits.length && <li className="text-ink-3">No audit entries.</li>}
          </ul>
        </Panel>
      </div>

      <Modal open={!!rev} onClose={() => setRev(null)} title="Reverse transaction">
        {rev && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">This removes {pts(rev.total_points)} points from {money(rev.eligible_amount)} on {dateTime(rev.created_at)}. The original record is kept and the reversal is logged.</p>
            <Field label="Reason (required)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong guest scanned" /></Field>
            <Alert>{err}</Alert>
            <button className="btn-beni w-full" onClick={doReverse}>Reverse {pts(rev.total_points)} points</button>
          </div>
        )}
      </Modal>
      <Modal open={adj} onClose={() => setAdj(false)} title="Manual point adjustment">
        <form onSubmit={doAdjust} className="space-y-3">
          <Field label="Points (+ or −)"><input className="input" type="number" value={adjF.points} onChange={(e) => setAdjF({ ...adjF, points: e.target.value })} required /></Field>
          <Field label="Reason (required, visible to guest)"><input className="input" value={adjF.reason} onChange={(e) => setAdjF({ ...adjF, reason: e.target.value })} required /></Field>
          <Alert>{err}</Alert>
          <button className="btn-primary w-full">Apply adjustment</button>
        </form>
      </Modal>
      <IssueRewardModal open={gift} onClose={() => setGift(false)} customer={{ id: Number(id), name: `${p.firstName} ${p.lastName}` }} onDone={load} />
    </>
  );
}

export function IssueRewardModal({ open, onClose, customer, onDone }) {
  const toast = useToast();
  const [rewards, setRewards] = useState([]);
  const [f, setF] = useState({ rewardId: '', title: '', note: '', validDays: 60 });
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) api('/admin/rewards').then((r) => setRewards(r.rows));
  }, [open]);
  const sel = rewards.find((r) => r.id === f.rewardId);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/admin/owner-rewards', { method: 'POST', body: { ...f, customerId: customer.id } });
      toast(`Reward issued · code ${r.code}`);
      onClose();
      onDone?.();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Owner’s Reward for ${customer?.name || ''}`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Menu item (optional)">
          <select className="input" value={f.rewardId} onChange={(e) => setF({ ...f, rewardId: e.target.value })}>
            <option value="">Custom reward (e.g. event invitation)</option>
            {rewards.map((r) => <option key={r.id} value={r.id}>{r.name} · {money(r.price)}</option>)}
          </select>
        </Field>
        <Field label="Title shown to guest" hint={sel ? `Defaults to “${sel.name}”` : 'Required for custom rewards'}>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Chef’s Thank-You: ..." />
        </Field>
        <Field label="Personal note"><textarea className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Thank you for being part of the Ema family!" /></Field>
        <Field label="Valid for (days)"><input className="input" type="number" min="1" max="365" value={f.validDays} onChange={(e) => setF({ ...f, validDays: e.target.value })} /></Field>
        {sel && <div className="rounded-xl bg-washi px-3 py-2 text-xs text-ink-3">Estimated variable cost: <b>{money(sel.economics.cost)}</b> (food cost assumption + fulfillment)</div>}
        <Alert>{err}</Alert>
        <button className="btn-beni w-full">Issue reward</button>
      </form>
    </Modal>
  );
}
