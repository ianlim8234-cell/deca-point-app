import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAdmin, PageHead, Panel } from './AdminApp.jsx';
import { PageLoader, Modal, Field, Alert, useToast, TierBadge, Toggle } from '../../components/ui.jsx';
import FoodArt from '../../components/FoodArt.jsx';
import { CATEGORIES } from '../../../shared/menu.js';
import { money, pts, pct, date, dateTime } from '../../lib/format.js';
import { IssueRewardModal } from './Customers.jsx';

export default function Rewards() {
  const { isOwner } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/admin/rewards').then((r) => setRows(r.rows)), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <PageLoader />;

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (edit.isNew) await api('/admin/rewards', { method: 'POST', body: edit });
      else await api(`/admin/rewards/${edit.id}`, { method: 'PUT', body: edit });
      toast('Reward saved');
      setEdit(null);
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Rewards marketplace"
        title="Rewards & point pricing"
        actions={isOwner && <button className="btn-primary" onClick={() => setEdit({ isNew: true, name: '', description: '', category: 'specialty', price: '', minTier: 'silver', active: true })}>+ Add reward</button>}
      >
        Point prices are calculated from menu price, food cost, fulfillment cost and the target reward cost rate. The owner can override any price. Items marked <span className="chip bg-kin-soft text-[#6b4f1d]">confirm</span> need their price checked against the in-store menu.
      </PageHead>
      <Panel>
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th className="text-right">Menu price</th><th className="text-right">Food cost</th><th className="text-right">Variable cost</th><th className="text-right">Points</th>
                <th className="text-right">Silver spend needed</th><th className="text-right">Cost rate (Silver → Plat.)</th><th>Eligibility</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = r.economics;
                return (
                  <tr key={r.id} className={!r.active ? 'opacity-50' : ''}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"><FoodArt category={r.category} imageUrl={r.imageUrl} name={r.name} /></div>
                        <div>
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-[11px] text-ink-4">source: {r.source}</div>
                        </div>
                      </div>
                    </td>
                    <td className="capitalize">{r.category}</td>
                    <td className="text-right">{money(r.price)} {r.priceStatus !== 'verified' && <span className="chip bg-kin-soft text-[10px] text-[#6b4f1d]">confirm</span>}</td>
                    <td className="text-right">{r.foodCostPct ? pct(r.foodCostPct, 0) : <span className="text-ink-4">category</span>}</td>
                    <td className="text-right">{money(e.cost)}</td>
                    <td className="text-right font-semibold">{pts(e.points)}{r.pointsOverride ? <span className="ml-1 text-[10px] text-ai">manual</span> : ''}</td>
                    <td className="text-right">{money(e.tiers[0].spendNeeded)}</td>
                    <td className={`whitespace-nowrap text-right ${e.flagged ? 'font-semibold text-beni' : ''}`}>{pct(e.silverCostRate, 2)} → {pct(e.worstCostRate, 2)}{e.flagged && ' ⚠'}</td>
                    <td><TierBadge tier={r.minTier} /></td>
                    <td>{r.active ? <span className="chip bg-matcha-soft text-matcha">active</span> : <span className="chip bg-washi-2">hidden</span>}</td>
                    <td>{isOwner && <button className="text-xs font-semibold text-beni hover:underline" onClick={() => { setErr(''); setEdit({ ...r, foodCostPct: r.foodCostPct ?? '', pointsOverride: r.pointsOverride ?? '', imageUrl: r.imageUrl ?? '' }); }}>Edit</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'Add reward' : `Edit ${edit?.name}`} wide>
        {edit && (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Category">
              <select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><input className="input" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
            <Field label="Menu price ($)"><input className="input" type="number" step="0.01" required value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label="Minimum tier">
              <select className="input" value={edit.minTier} onChange={(e) => setEdit({ ...edit, minTier: e.target.value })}>
                <option value="silver">Silver (everyone)</option><option value="gold">Gold+</option><option value="platinum">Platinum only</option>
              </select>
            </Field>
            {!edit.isNew && (
              <>
                <Field label="Food cost % (0–1)" hint="Blank = use category assumption"><input className="input" type="number" step="0.01" min="0" max="1" value={edit.foodCostPct} onChange={(e) => setEdit({ ...edit, foodCostPct: e.target.value })} /></Field>
                <Field label="Point price override" hint={`Blank = formula (${pts(edit.economics?.points)} pts)`}><input className="input" type="number" step="50" min="50" value={edit.pointsOverride} onChange={(e) => setEdit({ ...edit, pointsOverride: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field label="Photo URL (optional)" hint="Use Ema’s own food photography, e.g. /images/menu/edamame.jpg"><input className="input" value={edit.imageUrl} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} /></Field></div>
                <Field label="Price verified?">
                  <select className="input" value={edit.priceStatus} onChange={(e) => setEdit({ ...edit, priceStatus: e.target.value })}>
                    <option value="verified">Verified against menu</option><option value="confirm">Needs confirmation</option>
                  </select>
                </Field>
                <div className="flex items-end pb-2"><Toggle checked={!!edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Available in marketplace" /></div>
              </>
            )}
            <div className="sm:col-span-2"><Alert>{err}</Alert></div>
            <button className="btn-primary sm:col-span-2">Save</button>
          </form>
        )}
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------------------- promotions
export function Promotions() {
  const { isOwner, user } = useAdmin();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: '', description: '', start_at: '', end_at: '', multiplier: 1.5, tiers: [] });
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/admin/campaigns').then((r) => setRows(r.rows)), []);
  useEffect(() => {
    load();
  }, [load]);
  const create = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/admin/campaigns', { method: 'POST', body: { ...f, start_at: new Date(f.start_at).toISOString(), end_at: new Date(f.end_at).toISOString(), approve: isOwner } });
      toast(r.status === 'approved' ? 'Promotion approved and announced' : 'Promotion submitted for owner approval');
      setF({ name: '', description: '', start_at: '', end_at: '', multiplier: 1.5, tiers: [] });
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  const status = async (id, s) => {
    try {
      await api(`/admin/campaigns/${id}/status`, { method: 'POST', body: { status: s } });
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const now = Date.now();
  return (
    <>
      <PageHead eyebrow="Double-point days & seasonal campaigns" title="Promotions">
        Managers can propose campaigns. Only the owner can approve them, which is the financial sign-off. Multipliers are capped and never stack with off-peak bonuses (the highest one applies).
      </PageHead>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Panel title="New campaign" sub="Seasonal idea: Sakura Spring, Tanabata Summer, Momiji Autumn, Winter Ramen Nights">
          <form onSubmit={create} className="space-y-3">
            <Field label="Name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sakura Spring Week" /></Field>
            <Field label="Message to members"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts"><input className="input" type="datetime-local" required value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} /></Field>
              <Field label="Ends"><input className="input" type="datetime-local" required value={f.end_at} onChange={(e) => setF({ ...f, end_at: e.target.value })} /></Field>
            </div>
            <Field label="Multiplier">
              <select className="input" value={f.multiplier} onChange={(e) => setF({ ...f, multiplier: Number(e.target.value) })}>
                {[1.25, 1.5, 1.75, 2].map((m) => <option key={m} value={m}>{m}×</option>)}
              </select>
            </Field>
            <div>
              <span className="label">Eligible tiers (none = all)</span>
              <div className="flex gap-3">
                {['silver', 'gold', 'platinum'].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm capitalize">
                    <input type="checkbox" className="accent-beni" checked={f.tiers.includes(t)} onChange={(e) => setF({ ...f, tiers: e.target.checked ? [...f.tiers, t] : f.tiers.filter((x) => x !== t) })} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-washi px-3 py-2 text-xs text-ink-3">At {f.multiplier}×, a Silver member’s reward cost rises from about 2.0% to {pct(0.02 * f.multiplier)} of sales during the campaign.</div>
            <Alert>{err}</Alert>
            <button className="btn-primary w-full">{isOwner ? 'Create & approve' : 'Submit for approval'}</button>
          </form>
        </Panel>
        <Panel title="Campaigns">
          {!rows ? <PageLoader /> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Campaign</th><th>Window</th><th>Mult.</th><th>Tiers</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((c) => {
                    const live = c.status === 'approved' && new Date(c.start_at) <= now && new Date(c.end_at) > now;
                    const ended = new Date(c.end_at) < now;
                    return (
                      <tr key={c.id}>
                        <td><div className="font-semibold">{c.name}</div><div className="text-xs text-ink-3">{c.description}</div></td>
                        <td className="whitespace-nowrap text-xs">{dateTime(c.start_at)}<br />→ {dateTime(c.end_at)}</td>
                        <td>{c.multiplier}×</td>
                        <td className="text-xs capitalize">{JSON.parse(c.tiers || '[]').join(', ') || 'all'}</td>
                        <td><span className={`chip ${live ? 'bg-matcha text-white' : c.status === 'approved' ? 'bg-matcha-soft text-matcha' : c.status === 'pending' ? 'bg-kin-soft text-[#6b4f1d]' : 'bg-beni-soft text-beni-dark'}`}>{live ? 'LIVE' : ended ? 'ended' : c.status}</span></td>
                        <td className="whitespace-nowrap">
                          {!ended && c.status === 'pending' && isOwner && <button className="mr-2 text-xs font-semibold text-matcha" onClick={() => status(c.id, 'approved')}>Approve</button>}
                          {!ended && c.status === 'approved' && <button className="text-xs font-semibold text-beni" onClick={() => status(c.id, 'suspended')}>Suspend</button>}
                          {!ended && c.status === 'suspended' && isOwner && <button className="text-xs font-semibold text-matcha" onClick={() => status(c.id, 'approved')}>Resume</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={6} className="text-ink-3">No campaigns yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 text-xs text-ink-3">Signed in as {user.role}. {isOwner ? 'Your campaigns are approved immediately.' : 'Your campaigns wait for owner approval.'}</div>
        </Panel>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------- owner's rewards
export function OwnerRewards() {
  const { data, isOwner } = useAdmin();
  const [rows, setRows] = useState(null);
  const [target, setTarget] = useState(null);
  const load = useCallback(() => api('/admin/owner-rewards').then((r) => setRows(r.rows)), []);
  useEffect(() => {
    load();
  }, [load]);
  const candidates = data?.recognition;
  const totalCost = (rows || []).filter((r) => r.status !== 'void').reduce((s, r) => s + r.est_cost, 0);
  return (
    <>
      <PageHead eyebrow="Ema Exclusive" title="Owner’s Rewards">
        Personal, selective recognition for guests who keep coming back. These rewards are given individually by the owner. They are never automatic and never sold for points.
      </PageHead>
      {isOwner && candidates && (
        <Panel title="Suggested guests to recognize" sub="Highest engagement, off-peak champions, and valuable regulars who are at risk of lapsing">
          <div className="grid gap-3 md:grid-cols-3">
            {[['Most engaged', candidates.engaged.slice(0, 4), (p) => `score ${p.score}`], ['Off-peak champions', candidates.offpeak.slice(0, 4), (p) => `${p.offpeakVisits} quiet visits`], ['Win back (at risk)', candidates.atRisk.slice(0, 4), (p) => `${p.daysSince}d since visit`]].map(([title, list, m]) => (
              <div key={title}>
                <div className="eyebrow mb-2">{title}</div>
                <div className="space-y-1.5">
                  {list.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-washi-2 bg-paper px-3 py-2 text-sm">
                      <Link to={`/admin/customers/${p.id}`} className="min-w-0 truncate font-semibold hover:underline">{p.name}</Link>
                      <span className="shrink-0 text-xs text-ink-3">{m(p)}</span>
                      <button className="shrink-0 text-xs font-semibold text-beni" onClick={() => setTarget({ id: p.id, name: p.name })}>Gift</button>
                    </div>
                  ))}
                  {!list.length && <div className="text-sm text-ink-3">No one yet.</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Issued Owner’s Rewards" sub={`Estimated variable cost of non-void owner rewards: ${money(totalCost)}`}>
        {!rows ? <PageLoader /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Guest</th><th>Reward</th><th>Note</th><th>Issued</th><th>Expires</th><th className="text-right">Est. cost</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="font-semibold hover:underline" to={`/admin/customers/${r.customer_id}`}>{r.first_name} {r.last_name}</Link><div className="font-mono text-xs text-ink-4">{r.code}</div></td>
                    <td>{r.reward_name}</td>
                    <td className="max-w-xs text-xs italic text-ink-3">{r.note}</td>
                    <td className="whitespace-nowrap">{date(r.issued_at)}{r.issuer ? ` · ${r.issuer}` : ''}</td>
                    <td className="whitespace-nowrap">{date(r.expires_at)}</td>
                    <td className="text-right">{money(r.est_cost)}</td>
                    <td><span className="chip bg-washi-2">{r.status}</span></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="text-ink-3">None issued yet. Open a customer profile or use the suggestions above.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <IssueRewardModal open={!!target} onClose={() => setTarget(null)} customer={target} onDone={load} />
    </>
  );
}
