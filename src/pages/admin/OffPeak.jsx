import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { api } from '../../lib/api.js';
import { useAdmin, PageHead, Panel, CHART } from './AdminApp.jsx';
import { PageLoader, Stat, Toggle, Alert, useToast } from '../../components/ui.jsx';
import { RECOMMENDED_WINDOWS, PEAK_SUMMARY } from '../../../shared/popularTimes.js';
import { BaselineHeatmap, HOURS, ORDER } from '../../components/Heatmap.jsx';
import { fmtTime } from '../../../shared/engine.js';
import { money0, pts, pct, DAY_SHORT, hour12 } from '../../lib/format.js';

function ActualHeatmap({ heat }) {
  const max = Math.max(1, ...ORDER.flatMap((d) => HOURS.map((h) => heat[d]?.[h] || 0)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead><tr><th />{HOURS.map((h) => <th key={h} className="font-semibold text-ink-3">{hour12(h)}</th>)}</tr></thead>
        <tbody>
          {ORDER.map((d) => (
            <tr key={d}>
              <td className="pr-2 font-semibold">{DAY_SHORT[d]}</td>
              {HOURS.map((h) => {
                const v = heat[d]?.[h] || 0;
                return (
                  <td key={h} title={`${v} member visits`} className="h-9 min-w-[2.2rem] rounded-md text-center font-semibold" style={{ background: `rgba(47,62,85,${0.06 + (v / max) * 0.9})`, color: v / max > 0.5 ? 'white' : '#1d1917' }}>
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OffPeak() {
  const { data, isOwner, reload } = useAdmin();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [err, setErr] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    api('/admin/settings').then((r) => setSettings(r.settings));
  }, []);
  if (!data || !settings) return <PageLoader />;
  const op = settings.offpeak;
  const o = data.offpeak;
  const revenue = HOURS.map((h) => ({ hour: hour12(h), h, revenue: o.revenueByHour[h] || 0 }));

  const setWin = (i, patch) => {
    const windows = op.windows.map((w, j) => (j === i ? { ...w, ...patch } : w));
    setSettings({ ...settings, offpeak: { ...op, windows } });
    setDirty(true);
  };
  const save = async () => {
    setErr('');
    try {
      const r = await api('/admin/settings', { method: 'PUT', body: { settings } });
      setSettings(r.settings);
      setDirty(false);
      toast('Off-peak schedule saved');
      reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  const suspend = async (v) => {
    const r = await api('/admin/offpeak/suspend', { method: 'POST', body: { suspended: v } });
    setSettings({ ...settings, offpeak: { ...op, suspended: r.suspended } });
    toast(r.suspended ? 'Off-peak bonuses suspended' : 'Off-peak bonuses resumed');
  };

  return (
    <>
      <PageHead eyebrow="Demand shifting" title="Off-peak analytics & schedule">
        The bonus windows come from Ema’s Google “Popular times” profile. We reward only hours with spare capacity and never reward hours that are already busy.
      </PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Off-peak participation" value={pct(o.participation, 0)} sub="of visiting members used a bonus window" />
        <Stat label="Bonus points issued" value={pts(data.finance.offpeakBonusPts)} sub={`≈ ${money0(data.finance.offpeakBonusPts * data.finance.costPerPoint * 0.8)} expected cost`} />
        <Stat label="Window sales: last 30 days" value={money0(o.trend.last30)} sub={`${pct(o.trend.last30Share)} of member sales`} />
        <Stat label="Window sales: prior 30 days" value={money0(o.trend.prev30)} sub={`${pct(o.trend.prev30Share)} of member sales`} accent={o.trend.last30Share >= o.trend.prev30Share ? 'text-matcha' : 'text-beni'} />
      </div>

      <Panel title="Evidence: historical busyness (Google Popular times)" sub="Values are bar heights read from the 7 screenshots you supplied (0–100, relative to the week’s busiest hour, Fri 6 PM). Outlined cells are bonus windows.">
        <BaselineHeatmap windows={op.windows} />
        <ul className="mt-4 grid gap-1 text-sm text-ink-3 sm:grid-cols-2">
          {PEAK_SUMMARY.map((p) => <li key={p}>• Not rewarded: {p}</li>)}
        </ul>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Member visits by day & hour" sub="Verified loyalty transactions. Use this to check whether traffic is moving into the windows.">
          <ActualHeatmap heat={o.heat} />
        </Panel>
        <Panel title="Member revenue by hour" sub="All days combined. Compare with the busyness index above to see whether quiet hours are filling.">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={revenue}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} width={44} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => money0(v)} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {revenue.map((r) => <Cell key={r.h} fill={CHART.ai} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title="Bonus schedule"
        sub={isOwner ? 'Edit days, times and multipliers. Changes apply to the next transaction.' : 'Only the owner can edit windows. Managers can suspend all bonuses instantly.'}
        actions={<Toggle checked={!op.suspended} onChange={(v) => suspend(!v)} label={op.suspended ? 'Bonuses SUSPENDED' : 'Bonuses active'} />}
      >
        {op.suspended && <div className="mb-3"><Alert kind="warn">Off-peak bonuses are suspended. Guests earn standard points at all hours.</Alert></div>}
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Multiplier</th><th>Evidence</th><th>Enabled</th><th /></tr></thead>
            <tbody>
              {op.windows.map((w, i) => (
                <tr key={w.id} className={w.disabled ? 'opacity-50' : ''}>
                  <td>
                    <select className="input py-1.5" disabled={!isOwner} value={w.day} onChange={(e) => setWin(i, { day: Number(e.target.value) })}>
                      {DAY_SHORT.map((d, j) => <option key={d} value={j}>{d}</option>)}
                    </select>
                  </td>
                  <td><input className="input py-1.5" type="time" step="900" disabled={!isOwner} value={w.start} onChange={(e) => setWin(i, { start: e.target.value })} /></td>
                  <td><input className="input py-1.5" type="time" step="900" disabled={!isOwner} value={w.end} onChange={(e) => setWin(i, { end: e.target.value })} /></td>
                  <td>
                    <select className="input py-1.5" disabled={!isOwner} value={w.multiplier} onChange={(e) => setWin(i, { multiplier: Number(e.target.value) })}>
                      {[1.25, 1.5, 1.75, 2].map((m) => <option key={m} value={m}>{m}×</option>)}
                    </select>
                  </td>
                  <td className="text-xs text-ink-3">{w.evidence || 'Added manually'}<div>{fmtTime(w.start)}–{fmtTime(w.end)}</div></td>
                  <td><Toggle checked={!w.disabled} onChange={(v) => isOwner && setWin(i, { disabled: !v })} /></td>
                  <td>{isOwner && <button className="text-xs font-semibold text-beni" onClick={() => { setSettings({ ...settings, offpeak: { ...op, windows: op.windows.filter((_, j) => j !== i) } }); setDirty(true); }}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => { setSettings({ ...settings, offpeak: { ...op, windows: [...op.windows, { id: `w${Date.now()}`, day: 1, start: '14:00', end: '16:00', multiplier: 1.5 }] } }); setDirty(true); }}>+ Add window</button>
            <button className="btn-ghost" onClick={() => { setSettings({ ...settings, offpeak: { ...op, windows: RECOMMENDED_WINDOWS.map((w, i) => ({ id: `w${i + 1}`, ...w })) } }); setDirty(true); }}>Restore recommended schedule</button>
            <div className="flex-1" />
            <Toggle checked={op.onePerCustomerPerDay} onChange={(v) => { setSettings({ ...settings, offpeak: { ...op, onePerCustomerPerDay: v } }); setDirty(true); }} label="Limit: one bonus per member per day" />
            <button className="btn-primary" disabled={!dirty} onClick={save}>Save schedule</button>
          </div>
        )}
        <div className="mt-3"><Alert>{err}</Alert></div>
      </Panel>

      <Panel title="What the screenshots can’t tell us" sub="Information needed to fine-tune the schedule after launch">
        <ul className="grid gap-2 text-sm text-ink-3 md:grid-cols-2">
          <li>• <b>Absolute covers and sales per hour</b> from the POS. Google’s index is relative, so 30 on a Tuesday could still be 20 or 40 tables.</li>
          <li>• <b>Staffing schedule and labor cost per hour.</b> Quiet hours are cheap only if staff are already on shift.</li>
          <li>• <b>Seating capacity and table turn time</b>, to size how many extra guests each window can absorb.</li>
          <li>• <b>All-you-can-eat vs. à la carte mix by hour</b>, which affects contribution margin per visit.</li>
          <li>• <b>Seasonality and events</b> such as holidays, Woodlands concerts and school calendars.</li>
          <li>• <b>Pre- and post-launch comparison</b>, to separate new visits from shifted ones (see the Profit Simulator).</li>
        </ul>
      </Panel>
    </>
  );
}
