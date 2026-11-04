import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAdmin, PageHead, Panel } from './AdminApp.jsx';
import { PageLoader, Field, Alert, Toggle, useToast, Modal } from '../../components/ui.jsx';
import { costPerPoint } from '../../../shared/engine.js';
import { money, pct, pts, dateTime } from '../../lib/format.js';

const num = (v) => (v === '' ? '' : Number(v));

export default function Settings() {
  const { reload } = useAdmin();
  const toast = useToast();
  const [s, setS] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    api('/admin/settings').then((r) => { setS(r.settings); setDefaults(r.defaults); });
    api('/admin/rewards').then((r) => setRewards(r.rows));
  }, []);
  if (!s) return <PageLoader />;

  const up = (path, value) => {
    const next = structuredClone(s);
    let o = next;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path.at(-1)] = value;
    setS(next);
    setDirty(true);
  };
  const save = async () => {
    setErr('');
    try {
      const r = await api('/admin/settings', { method: 'PUT', body: { settings: s } });
      setS(r.settings);
      setDirty(false);
      toast('Program settings saved');
      reload();
    } catch (e) {
      setErr(e.message);
    }
  };

  const cpp = rewards.length ? costPerPoint(s, rewards.map((r) => ({ ...r, pointsOverride: r.pointsOverride }))) : 0.002;
  const warnings = [];
  for (const t of s.tiers) {
    const rate = t.rate * cpp;
    if (rate > s.finance.maxRewardCostRate) warnings.push(`${t.name}: ${t.rate} pts/$ × ${money(cpp, 4)}/pt = ${pct(rate, 2)} reward cost, which exceeds the ${pct(s.finance.maxRewardCostRate)} limit.`);
  }
  const tiers = [...s.tiers].sort((a, b) => a.minSpend - b.minSpend);
  for (let i = 0; i < tiers.length - 1; i++) {
    const t = tiers[i];
    const span = (tiers[i + 1].minSpend - t.minSpend) * t.rate;
    const top = Math.max(0, ...(s.milestones[t.key] || []).map((m) => m.points));
    if (top > span) warnings.push(`${t.name} milestone at ${pts(top)} pts is unlikely to be reached before ${tiers[i + 1].name} (≈ ${pts(span)} pts in this tier).`);
  }

  return (
    <>
      <PageHead
        eyebrow="Owner only"
        title="Program settings"
        actions={<button className="btn-primary" disabled={!dirty} onClick={save}>{dirty ? 'Save changes' : 'Saved'}</button>}
      >
        Every rule the points engine uses is set here. Changes apply to future transactions only. Past transactions keep the rate they earned at, and every change is written to the audit log.
      </PageHead>
      {warnings.length > 0 && <Alert kind="warn"><b>Financial check:</b><ul className="mt-1 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></Alert>}
      <Alert>{err}</Alert>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Membership tiers" sub="Thresholds use qualifying lifetime spend. These are SAMPLE values. Confirm them against Ema’s average check and visit frequency.">
          <div className="space-y-3">
            {s.tiers.map((t, i) => (
              <div key={t.key} className="grid grid-cols-3 gap-2">
                <Field label="Name"><input className="input" value={t.name} onChange={(e) => up(['tiers', i, 'name'], e.target.value)} /></Field>
                <Field label="Unlocks at ($)"><input className="input" type="number" disabled={i === 0} value={t.minSpend} onChange={(e) => up(['tiers', i, 'minSpend'], num(e.target.value))} /></Field>
                <Field label="Points per $1"><input className="input" type="number" step="0.5" value={t.rate} onChange={(e) => up(['tiers', i, 'rate'], num(e.target.value))} /></Field>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Point earning rules">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum qualifying purchase ($)"><input className="input" type="number" step="0.5" value={s.eligibility.minPurchase} onChange={(e) => up(['eligibility', 'minPurchase'], num(e.target.value))} /></Field>
            <Field label="Max promotional multiplier"><input className="input" type="number" step="0.25" min="1" max="3" value={s.promotions.maxMultiplier} onChange={(e) => up(['promotions', 'maxMultiplier'], num(e.target.value))} /></Field>
            <Toggle checked={s.eligibility.includeTax} onChange={(v) => up(['eligibility', 'includeTax'], v)} label="Tax counts toward points" />
            <Toggle checked={s.eligibility.includeTip} onChange={(v) => up(['eligibility', 'includeTip'], v)} label="Tips count toward points" />
            <Toggle checked={s.promotions.allowStacking} onChange={(v) => up(['promotions', 'allowStacking'], v)} label="Allow multipliers to stack" />
            <div className="sm:col-span-2"><Field label="Excluded purchase categories (shown to members)"><input className="input" value={s.eligibility.excludedNote} onChange={(e) => up(['eligibility', 'excludedNote'], e.target.value)} /></Field></div>
            <Field label="Points expire after inactive months (0 = never)" hint="Requires legal review"><input className="input" type="number" min="0" value={s.expiration.pointsExpireAfterInactiveMonths} onChange={(e) => up(['expiration', 'pointsExpireAfterInactiveMonths'], num(e.target.value))} /></Field>
            <Field label="Reward codes valid for (days)"><input className="input" type="number" min="1" value={s.expiration.rewardValidDays} onChange={(e) => up(['expiration', 'rewardValidDays'], num(e.target.value))} /></Field>
          </div>
          <div className="mt-3 text-xs text-ink-3">Rounding: points = floor(eligible pre-tax amount × tier rate). Bonus = floor(base × (multiplier − 1)).</div>
        </Panel>

        <Panel title="Financial assumptions & safeguards" sub="Replace these with Ema’s actual cost data when it is available">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target reward cost rate" hint="Used to price rewards"><PctInput value={s.finance.targetRewardCostRate} onChange={(v) => up(['finance', 'targetRewardCostRate'], v)} /></Field>
            <Field label="Maximum reward cost rate" hint="Rewards above this are flagged"><PctInput value={s.finance.maxRewardCostRate} onChange={(v) => up(['finance', 'maxRewardCostRate'], v)} /></Field>
            <Field label="Contribution margin"><PctInput value={s.finance.contributionMargin} onChange={(v) => up(['finance', 'contributionMargin'], v)} /></Field>
            <Field label="Expected breakage"><PctInput value={s.finance.breakageRate} onChange={(v) => up(['finance', 'breakageRate'], v)} /></Field>
            <Field label="Fulfillment cost per reward ($)"><input className="input" type="number" step="0.05" value={s.finance.fulfillmentCost} onChange={(e) => up(['finance', 'fulfillmentCost'], num(e.target.value))} /></Field>
            <Field label="Monthly redemption budget ($ cost)"><input className="input" type="number" step="100" value={s.finance.monthlyRedemptionBudget} onChange={(e) => up(['finance', 'monthlyRedemptionBudget'], num(e.target.value))} /></Field>
          </div>
          <div className="mt-4 eyebrow">Food cost by category (assumption)</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {Object.entries(s.finance.foodCostByCategory).map(([k, v]) => (
              <Field key={k} label={k}><PctInput value={v} onChange={(nv) => up(['finance', 'foodCostByCategory', k], nv)} /></Field>
            ))}
          </div>
        </Panel>

        <Panel title="Milestone gifts" sub="Points earned inside the current tier. Platinum milestones repeat.">
          {['silver', 'gold', 'platinum'].map((tk) => (
            <div key={tk} className="mb-4">
              <div className="eyebrow mb-1 capitalize">{tk}</div>
              {(s.milestones[tk] || []).map((m, i) => (
                <div key={m.key} className="mb-2 grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2">
                  <input className="input py-1.5" type="number" step="50" value={m.points} onChange={(e) => up(['milestones', tk, i, 'points'], num(e.target.value))} />
                  <input className="input py-1.5" value={m.label} onChange={(e) => up(['milestones', tk, i, 'label'], e.target.value)} />
                  <select className="input py-1.5" value={m.rewardId} onChange={(e) => up(['milestones', tk, i, 'rewardId'], e.target.value)}>
                    {rewards.map((r) => <option key={r.id} value={r.id}>{r.name} ({money(r.price)})</option>)}
                  </select>
                  <button className="text-xs text-beni" onClick={() => up(['milestones', tk], s.milestones[tk].filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="text-xs font-semibold text-ink-3 hover:text-ink" onClick={() => up(['milestones', tk], [...(s.milestones[tk] || []), { key: `${tk[0]}${Date.now()}`, points: 1000, rewardId: rewards[0]?.id, label: 'New milestone' }])}>+ Add milestone</button>
              <MilestoneCost s={s} tk={tk} rewards={rewards} />
            </div>
          ))}
        </Panel>

        <Panel title="Engagement features">
          <div className="space-y-4">
            <div>
              <Toggle checked={s.streaks.enabled} onChange={(v) => up(['streaks', 'enabled'], v)} label="Monthly visit streaks" />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {s.streaks.levels.map((l, i) => (
                  <div key={i} className="rounded-xl bg-washi p-2">
                    <Field label="Visits"><input className="input py-1.5" type="number" value={l.visits} onChange={(e) => up(['streaks', 'levels', i, 'visits'], num(e.target.value))} /></Field>
                    <Field label="Bonus pts"><input className="input mt-1 py-1.5" type="number" step="25" value={l.points} onChange={(e) => up(['streaks', 'levels', i, 'points'], num(e.target.value))} /></Field>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs text-ink-3">Visits count once per day. 500 pts ≈ {money(500 * cpp)} variable cost.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Toggle checked={s.birthday.enabled} onChange={(v) => up(['birthday', 'enabled'], v)} label="Birthday reward" />
                <select className="input mt-2" value={s.birthday.rewardId} onChange={(e) => up(['birthday', 'rewardId'], e.target.value)}>
                  {rewards.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <Toggle checked={s.referral.enabled} onChange={(v) => up(['referral', 'enabled'], v)} label="Referral program" />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="Referrer"><input className="input py-1.5" type="number" value={s.referral.referrerPoints} onChange={(e) => up(['referral', 'referrerPoints'], num(e.target.value))} /></Field>
                  <Field label="New member"><input className="input py-1.5" type="number" value={s.referral.refereePoints} onChange={(e) => up(['referral', 'refereePoints'], num(e.target.value))} /></Field>
                  <Field label="Min $"><input className="input py-1.5" type="number" value={s.referral.minPurchase} onChange={(e) => up(['referral', 'minPurchase'], num(e.target.value))} /></Field>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Restaurant & terms">
          <div className="grid gap-3">
            <Field label="Restaurant name"><input className="input" value={s.restaurant.name} onChange={(e) => up(['restaurant', 'name'], e.target.value)} /></Field>
            <Field label="Address"><input className="input" value={s.restaurant.address} onChange={(e) => up(['restaurant', 'address'], e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone"><input className="input" value={s.restaurant.phone} onChange={(e) => up(['restaurant', 'phone'], e.target.value)} /></Field>
              <Field label="Time zone"><input className="input" value={s.restaurant.timezone} onChange={(e) => up(['restaurant', 'timezone'], e.target.value)} /></Field>
            </div>
            <Field label="Online ordering URL"><input className="input" value={s.restaurant.orderUrl} onChange={(e) => up(['restaurant', 'orderUrl'], e.target.value)} /></Field>
            <Field label="Program terms (draft, pending legal review)"><textarea className="input" rows={6} value={s.terms} onChange={(e) => up(['terms'], e.target.value)} /></Field>
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!dirty} onClick={save}>Save changes</button>
        <button className="btn-ghost" onClick={() => { if (window.confirm('Reset ALL settings to the recommended defaults? (not saved until you click Save)')) { setS(structuredClone(defaults)); setDirty(true); } }}>Load recommended defaults</button>
      </div>
      <DemoDataPanel />
    </>
  );
}

function PctInput({ value, onChange }) {
  return (
    <div className="relative">
      <input className="input pr-8" type="number" step="0.1" value={Math.round(value * 1000) / 10} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value) / 100)} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">%</span>
    </div>
  );
}

function MilestoneCost({ s, tk, rewards }) {
  const list = s.milestones[tk] || [];
  const tier = s.tiers.find((t) => t.key === tk);
  if (!list.length || !tier) return null;
  const top = Math.max(...list.map((m) => m.points));
  const spend = top / tier.rate;
  let cost = 0;
  for (const m of list) {
    const r = rewards.find((x) => x.id === m.rewardId);
    if (r) cost += r.economics.cost;
  }
  return <div className="mt-1 text-xs text-ink-3">All {tier.name} gifts ≈ {money(cost)} cost over ≈ {money(spend)} of spend = <b>{pct(cost / spend, 2)}</b> extra reward cost.</div>;
}

function DemoDataPanel() {
  const { reload } = useAdmin();
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const run = async (action) => {
    await api('/admin/demo-data', { method: 'POST', body: { action } });
    toast(action === 'remove' ? 'Demonstration data removed' : 'Demonstration data loaded');
    setConfirm(null);
    reload();
  };
  return (
    <Panel title="Demonstration data" sub="Sample members and transactions for presentations, all labeled ‘demo’. Remove them before real customers join.">
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={() => setConfirm('load')}>Load demo data</button>
        <button className="btn-beni" onClick={() => setConfirm('remove')}>Remove all demo data</button>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'remove' ? 'Remove demo data?' : 'Load demo data?'}>
        <p className="text-sm text-ink-3">{confirm === 'remove' ? 'This permanently deletes every demo member, transaction, reward and campaign. Real customer data is not touched.' : 'Adds 42 sample members with about four months of simulated visits that follow the popular-times pattern.'}</p>
        <button className="btn-primary mt-4 w-full" onClick={() => run(confirm)}>Confirm</button>
      </Modal>
    </Panel>
  );
}

// ----------------------------------------------------------------------------- staff
export function Staff() {
  const { user } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', role: 'employee', password: '' });
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/admin/staff').then((r) => setRows(r.rows)), []);
  useEffect(() => {
    load();
  }, [load]);
  const create = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/admin/staff', { method: 'POST', body: f });
      toast('Staff account created');
      setF({ firstName: '', lastName: '', email: '', role: 'employee', password: '' });
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  const update = async (id, body) => {
    try {
      await api(`/admin/staff/${id}`, { method: 'PUT', body });
      toast('Updated');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <>
      <PageHead eyebrow="Owner only" title="Staff accounts & permissions" />
      <Panel title="Permission levels">
        <div className="-mx-5 overflow-x-auto">
          <table className="table text-xs">
            <thead><tr><th>Capability</th><th>Customer</th><th>Employee</th><th>Manager</th><th>Owner</th></tr></thead>
            <tbody>
              {[
                ['View own points, QR code and redeem rewards', 1, 0, 0, 0],
                ['Scan QR codes, record purchases, verify rewards', 0, 1, 1, 1],
                ['View analytics, customers and audit log', 0, 0, 1, 1],
                ['Reverse transactions, void rewards, adjust points', 0, 0, 1, 1],
                ['Propose or suspend promotions and suspend off-peak bonuses', 0, 0, 1, 1],
                ['Approve promotions (financial approval)', 0, 0, 0, 1],
                ['Edit program settings, reward prices and the off-peak schedule', 0, 0, 0, 1],
                ['Issue Owner’s Rewards, manage staff, remove demo data', 0, 0, 0, 1],
              ].map(([l, ...c]) => (
                <tr key={l}><td>{l}</td>{c.map((v, i) => <td key={i}>{v ? '✓' : ''}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Panel title="Add staff member">
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="First name"><input className="input" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
              <Field label="Last name"><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
            </div>
            <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role">
              <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="employee">Employee</option><option value="manager">Manager</option><option value="owner">Owner</option>
              </select>
            </Field>
            <Field label="Temporary password"><input className="input" type="text" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <Alert>{err}</Alert>
            <button className="btn-primary w-full">Create account</button>
          </form>
        </Panel>
        <Panel title="Team">
          {!rows ? <PageLoader /> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                      <td className="font-semibold">{r.first_name} {r.last_name}{r.id === user.id && ' (you)'}</td>
                      <td>{r.email}</td>
                      <td>
                        <select className="input py-1" value={r.role} disabled={r.id === user.id} onChange={(e) => update(r.id, { role: e.target.value })}>
                          <option value="employee">Employee</option><option value="manager">Manager</option><option value="owner">Owner</option>
                        </select>
                      </td>
                      <td>{r.active ? 'Active' : 'Disabled'}</td>
                      <td className="whitespace-nowrap">
                        <button className="mr-3 text-xs font-semibold text-ink-3 hover:text-ink" onClick={() => { const p = window.prompt('New password (min 8 characters):'); if (p) update(r.id, { password: p }); }}>Reset password</button>
                        {r.id !== user.id && <button className="text-xs font-semibold text-beni" onClick={() => update(r.id, { active: !r.active })}>{r.active ? 'Disable' : 'Enable'}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      <ChangeOwnPassword />
    </>
  );
}

function ChangeOwnPassword() {
  const toast = useToast();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/account/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (e2) {
      setErr(e2.message);
    }
  };
  return (
    <Panel title="Change my password" sub="Change the default passwords before going live">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input className="input" type="password" placeholder="New password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className="btn-primary">Update</button>
        <div className="sm:col-span-3"><Alert>{err}</Alert></div>
      </form>
    </Panel>
  );
}

// ----------------------------------------------------------------------------- audit log
export function ActivityLog() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('audit');
  const [tx, setTx] = useState(null);
  const [reds, setReds] = useState(null);
  useEffect(() => {
    api('/admin/audit').then((r) => setRows(r.rows));
    api('/admin/transactions').then((r) => setTx(r.rows));
    api('/admin/redemptions').then((r) => setReds(r.rows));
  }, []);
  return (
    <>
      <PageHead eyebrow="Accountability" title="Audit log & transaction ledger">Every purchase, reversal, redemption, settings change and manual lookup is recorded with who did it and when.</PageHead>
      <div className="flex gap-2">
        {[['audit', 'Audit log'], ['tx', 'Transactions'], ['red', 'Redemptions']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-washi' : 'bg-paper text-ink-3'}`}>{l}</button>
        ))}
      </div>
      <Panel>
        <div className="-mx-5 overflow-x-auto">
          {tab === 'audit' && (!rows ? <PageLoader /> : (
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{dateTime(r.created_at)}</td>
                    <td>{r.first_name ? `${r.first_name} ${r.last_name}` : 'system'}<div className="text-xs capitalize text-ink-4">{r.role}</div></td>
                    <td className="font-semibold">{r.action}</td>
                    <td className="text-xs">{r.entity} {r.entity_id}</td>
                    <td className="max-w-md break-all font-mono text-[11px] text-ink-3">{r.details}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="text-ink-3">No entries yet.</td></tr>}
              </tbody>
            </table>
          ))}
          {tab === 'tx' && (!tx ? <PageLoader /> : (
            <table className="table">
              <thead><tr><th>When</th><th>Guest</th><th>Staff</th><th>Receipt</th><th className="text-right">Eligible</th><th className="text-right">Points</th><th>Status</th></tr></thead>
              <tbody>
                {tx.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{dateTime(t.created_at)}</td>
                    <td>{t.first_name} {t.last_name}{t.is_demo ? <span className="ml-1 chip bg-kin-soft text-[10px] text-[#6b4f1d]">demo</span> : null}</td>
                    <td>{t.employee || '—'}</td>
                    <td>{t.receipt_no || '—'}</td>
                    <td className="text-right">{money(t.eligible_amount)}</td>
                    <td className="text-right">{pts(t.total_points)}{t.offpeak_bonus ? ' 🌙' : ''}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          {tab === 'red' && (!reds ? <PageLoader /> : (
            <table className="table">
              <thead><tr><th>Issued</th><th>Guest</th><th>Reward</th><th>Source</th><th className="text-right">Points</th><th className="text-right">Est. cost</th><th>Status</th><th>Verified by</th></tr></thead>
              <tbody>
                {reds.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{dateTime(r.issued_at)}</td>
                    <td>{r.first_name} {r.last_name}</td>
                    <td>{r.reward_name}<div className="font-mono text-[11px] text-ink-4">{r.code}</div></td>
                    <td className="capitalize">{r.source}</td>
                    <td className="text-right">{r.points_spent ? pts(r.points_spent) : '—'}</td>
                    <td className="text-right">{money(r.est_cost)}</td>
                    <td>{r.status}</td>
                    <td>{r.verifier || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </Panel>
    </>
  );
}
