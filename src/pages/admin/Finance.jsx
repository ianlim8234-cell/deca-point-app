import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine } from 'recharts';
import { api } from '../../lib/api.js';
import { useAdmin, PageHead, Panel, CHART, TIER_COLORS } from './AdminApp.jsx';
import { PageLoader, Stat, Field, Alert } from '../../components/ui.jsx';
import { simulate, rewardCost } from '../../../shared/engine.js';
import { money, money0, pts, pct, kfmt } from '../../lib/format.js';

export default function Finance() {
  const { data } = useAdmin();
  const [settings, setSettings] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [costInput, setCostInput] = useState(5);
  useEffect(() => {
    api('/admin/settings').then((r) => setSettings(r.settings));
    api('/admin/rewards').then((r) => setRewards(r.rows));
  }, []);
  if (!data || !settings || !rewards) return <PageLoader />;
  const f = data.finance;
  const fin = settings.finance;
  const avgFood = Object.values(fin.foodCostByCategory).reduce((a, b) => a + b, 0) / Object.values(fin.foodCostByCategory).length;
  const grossProfit = f.totalSales * (1 - avgFood);
  const active = rewards.filter((r) => r.active);
  const retailPerPoint = active.reduce((s, r) => s + r.price / r.economics.points, 0) / active.length;

  const tierEcon = settings.tiers.map((t) => ({
    ...t,
    retail: t.rate * retailPerPoint,
    cost: t.rate * f.costPerPoint,
    cost15: t.rate * 1.5 * f.costPerPoint,
    cost2: t.rate * 2 * f.costPerPoint,
    netCost: t.rate * f.costPerPoint * (1 - fin.breakageRate),
  }));
  const requiredSpend = costInput / fin.targetRewardCostRate;

  return (
    <>
      <PageHead eyebrow="Profitability is the priority" title="Financial analytics">
        Every figure keeps revenue, gross profit and contribution profit separate. Food-cost percentages, contribution margin and breakage are <b>labeled assumptions</b>. Replace them with Ema’s actual numbers in Program Settings.
      </PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (member sales)" value={money0(f.totalSales)} sub="eligible pre-tax sales" />
        <Stat label="Gross profit (est.)" value={money0(grossProfit)} sub={`revenue × (1 − ${pct(avgFood, 0)} avg food cost)`} />
        <Stat label="Contribution profit (est.)" value={money0(f.contributionBeforeRewards)} sub={`revenue × ${pct(fin.contributionMargin, 0)} contribution margin`} />
        <Stat label="Contribution after rewards" value={money0(f.contributionAfterRewards)} sub={`minus ${money0(f.accruedRewardCost)} accrued reward cost`} accent="text-matcha" />
        <Stat label="Points issued" value={pts(f.pointsIssued)} sub={`${pts(f.pointsRedeemed)} redeemed · ${pts(f.pointsExpired)} expired`} />
        <Stat label="Outstanding liability" value={money0(f.liability)} sub={`${pts(f.outstanding)} pts unredeemed`} />
        <Stat label="Avg reward cost" value={money(f.avgRewardCost)} sub={`${money0(f.rewardCostTotal)} total issued or used`} />
        <Stat label="90-day redemption forecast" value={money0(data.forecast90.cost)} sub={`${pts(data.forecast90.points)} pts at the recent redemption pace`} />
      </div>
      <Alert kind="info">
        <b>Incremental profit</b> cannot be measured from loyalty data alone, because some of these visits would have happened anyway. The Profit Simulator estimates it from transparent assumptions. After launch, compare total restaurant sales before and after (or use a control period) to measure it.
      </Alert>

      <Panel title="Point economics by tier" sub="How much each $1 of qualifying spend costs Ema in rewards. Points issued are not dollars of value.">
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Tier</th><th className="text-right">Pts / $1</th><th className="text-right">Retail value back</th><th className="text-right">Variable cost (standard)</th><th className="text-right">At 1.5× off-peak</th><th className="text-right">At 2× off-peak</th><th className="text-right">Net of {pct(fin.breakageRate, 0)} breakage</th></tr></thead>
            <tbody>
              {tierEcon.map((t) => (
                <tr key={t.key}>
                  <td className="font-semibold">{t.name}</td>
                  <td className="text-right">{t.rate}</td>
                  <td className="text-right">{pct(t.retail)}</td>
                  <td className={`text-right font-semibold ${t.cost > fin.maxRewardCostRate ? 'text-beni' : ''}`}>{pct(t.cost, 2)}</td>
                  <td className="text-right">{pct(t.cost15, 2)}</td>
                  <td className="text-right">{pct(t.cost2, 2)}</td>
                  <td className="text-right">{pct(t.netCost, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Average variable cost per point = {money(f.costPerPoint, 5)}. Average menu value per point = {money(retailPerPoint, 5)}. Off-peak bonuses cost more per dollar, but they fill seats when staff and rent are already paid, so
          each <i>new</i> off-peak visit adds roughly {pct(fin.contributionMargin, 0)} contribution against a 2–5% reward cost.
        </p>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Profitability by membership tier" sub="Contribution after accrued reward cost">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.tiers}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={kfmt} width={44} />
                <Tooltip formatter={(v) => money0(v)} />
                <Legend />
                <Bar dataKey="sales" name="Revenue" fill={CHART.grid} radius={[6, 6, 0, 0]} />
                <Bar dataKey="contribution" name="Contribution after rewards" radius={[6, 6, 0, 0]}>
                  {data.tiers.map((t) => <Cell key={t.key} fill={TIER_COLORS[t.key]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            {data.tiers.map((t) => <div key={t.key} className="rounded-lg bg-washi py-1.5">{t.name}: reward cost <b>{pct(t.costRate, 2)}</b></div>)}
          </div>
        </Panel>
        <Panel title="Profitability by promotional period">
          <div className="-mx-5 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Period</th><th className="text-right">Visits</th><th className="text-right">Revenue</th><th className="text-right">Points</th><th className="text-right">Reward cost</th><th className="text-right">Cost rate</th><th className="text-right">Contribution</th></tr></thead>
              <tbody>
                {Object.entries(data.periods).map(([k, p]) => (
                  <tr key={k}>
                    <td className="font-semibold">{p.label}</td>
                    <td className="text-right">{pts(p.visits)}</td>
                    <td className="text-right">{money0(p.sales)}</td>
                    <td className="text-right">{pts(p.points)}</td>
                    <td className="text-right">{money0(p.rewardCost)}</td>
                    <td className={`text-right ${p.costRate > fin.maxRewardCostRate ? 'font-semibold text-kin' : ''}`}>{pct(p.costRate, 2)}</td>
                    <td className="text-right font-semibold">{money0(p.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Off-peak and promotional periods carry a higher reward cost rate by design. They pay off only if enough of those visits are incremental. Test this in the simulator.</p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Financial control calculator" sub="How much qualifying spend must a reward be backed by?">
          <Field label="Reward variable cost ($)">
            <input className="input" type="number" step="0.25" min="0" value={costInput} onChange={(e) => setCostInput(Number(e.target.value))} />
          </Field>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Target reward cost rate</span><b>{pct(fin.targetRewardCostRate)}</b></div>
            <div className="flex justify-between"><span>Required qualifying spend</span><b>{money(requiredSpend)}</b></div>
            {settings.tiers.map((t) => (
              <div key={t.key} className="flex justify-between"><span>Points required if priced for {t.name} ({t.rate}/$)</span><b>{pts(Math.ceil((requiredSpend * t.rate) / 50) * 50)}</b></div>
            ))}
            <div className="flex justify-between"><span>Contribution generated by that spend</span><b>{money(requiredSpend * fin.contributionMargin)}</b></div>
          </div>
          <p className="mt-3 text-xs text-ink-3">Rewards are priced on the Silver rate, so higher tiers effectively get a bigger discount, up to the {pct(fin.maxRewardCostRate)} cap.</p>
        </Panel>
        <Panel title="Rewards over the cost limit" sub={`Any reward whose cost exceeds ${pct(fin.maxRewardCostRate)} of the spend needed to earn it (at Platinum rate) is flagged`}>
          {data.rewardFlags.length === 0 ? (
            <Alert kind="success">All active rewards are within the maximum reward cost rate.</Alert>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.rewardFlags.map((r) => (
                <li key={r.id} className="flex justify-between rounded-xl bg-beni-soft px-3 py-2"><span>{r.name}</span><b>{pct(r.worstCostRate, 2)}</b></li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-xs text-ink-3">
            Reward point pricing formula: <code className="rounded bg-washi px-1">points = ceil₅₀( (price × food cost % + {money(fin.fulfillmentCost)}) ÷ {pct(fin.targetRewardCostRate)} × 10 )</code>
            <div className="mt-1">Example: Edamame {money(5)} × 30% + $0.25 = {money(rewardCost(settings, { price: 5, category: 'appetizers' }))} cost → needs {money(rewardCost(settings, { price: 5, category: 'appetizers' }) / fin.targetRewardCostRate)} of spend → 900 pts.</div>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------- simulator
function Slider({ label, value, onChange, min, max, step, fmt, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-display text-lg font-bold">{fmt(value)}</span>
      </div>
      <input type="range" className="w-full accent-beni" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="text-xs text-ink-4">{hint}</div>}
    </div>
  );
}

export function Simulator() {
  const { data } = useAdmin();
  const [s, setS] = useState(null);
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api('/admin/settings').then((r) => setSettings(r.settings));
  }, []);
  useEffect(() => {
    if (!settings || s) return;
    const fin = settings.finance;
    setS({
      members: 500,
      baselineVisitsPerYear: 6,
      avgCheck: Math.round(data?.customers?.avgCheck || 45),
      visitLiftPct: 0.12,
      checkLiftPct: 0.03,
      contributionMargin: fin.contributionMargin,
      earnRate: 10.6, // blended pts/$ across tiers
      extrasRate: 0.02, // milestones, streaks, birthday and referral gifts as % of sales (before breakage)
      costPerPoint: data?.finance?.costPerPoint || fin.targetRewardCostRate / 10,
      breakageRate: fin.breakageRate,
      offpeakShareOfVisits: 0.2,
      offpeakAvgMultiplier: 1.6,
      offpeakIncrementalShare: 0.4,
      offpeakLaborSavingsPerShiftedVisit: 0,
      programFixedCostPerYear: 1200,
      marketingCostPerYear: 1000,
    });
  }, [settings, data, s]);

  const result = useMemo(() => {
    if (!s) return null;
    const rewardCostRate = (s.earnRate * s.costPerPoint + s.extrasRate) * (1 - s.breakageRate);
    return { ...simulate({ ...s, rewardCostRate }), rewardCostRate };
  }, [s]);

  if (!s || !result) return <PageLoader />;
  const set = (k) => (v) => setS({ ...s, [k]: v });
  const chart = [
    { name: 'Without program', Revenue: result.scenario1.revenue, Contribution: result.scenario1.contribution },
    { name: 'With Ema Rewards', Revenue: result.scenario2.revenue, Contribution: result.scenario2.contribution },
  ];
  const waterfall = [
    { name: 'Added contribution', v: result.grossProfitIncrement },
    { name: 'Standard rewards', v: -result.standardRewardCost },
    { name: 'Off-peak bonus', v: -result.offpeakExtraRewardCost },
    { name: 'Marketing & ops', v: -result.otherCosts },
    { name: 'Incremental profit', v: result.incrementalContribution },
  ];
  return (
    <>
      <PageHead eyebrow="What-if analysis · projection, not actual results" title="Profitability simulator">
        Change the assumptions and see the projected annual effect right away. Incremental contribution profit = incremental revenue × contribution margin − reward costs − promotion costs − other costs.
      </PageHead>
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Panel title="Customer behavior">
            <div className="space-y-4">
              <Slider label="Active members" value={s.members} onChange={set('members')} min={50} max={3000} step={50} fmt={pts} />
              <Slider label="Baseline visits / member / year" value={s.baselineVisitsPerYear} onChange={set('baselineVisitsPerYear')} min={1} max={24} step={0.5} fmt={(v) => v} />
              <Slider label="Average check" value={s.avgCheck} onChange={set('avgCheck')} min={15} max={120} step={1} fmt={money0} />
              <Slider label="Visit lift from loyalty" value={s.visitLiftPct} onChange={set('visitLiftPct')} min={0} max={0.5} step={0.01} fmt={(v) => pct(v, 0)} hint="Restaurant loyalty programs commonly target 5–20%" />
              <Slider label="Check-size lift" value={s.checkLiftPct} onChange={set('checkLiftPct')} min={0} max={0.2} step={0.01} fmt={(v) => pct(v, 0)} />
            </div>
          </Panel>
          <Panel title="Program economics">
            <div className="space-y-4">
              <Slider label="Contribution margin" value={s.contributionMargin} onChange={set('contributionMargin')} min={0.3} max={0.8} step={0.01} fmt={(v) => pct(v, 0)} />
              <Slider label="Blended earn rate (pts/$)" value={s.earnRate} onChange={set('earnRate')} min={5} max={15} step={0.1} fmt={(v) => v.toFixed(1)} />
              <Slider label="Variable cost per point" value={s.costPerPoint} onChange={set('costPerPoint')} min={0.0005} max={0.005} step={0.0001} fmt={(v) => money(v, 4)} />
              <Slider label="Milestones, streaks & birthday gifts" value={s.extrasRate} onChange={set('extrasRate')} min={0} max={0.05} step={0.001} fmt={(v) => pct(v, 1)} hint="Extra reward cost as % of member sales (before breakage)" />
              <Slider label="Breakage (never redeemed)" value={s.breakageRate} onChange={set('breakageRate')} min={0} max={0.5} step={0.01} fmt={(v) => pct(v, 0)} />
              <Slider label="Marketing cost / year" value={s.marketingCostPerYear} onChange={set('marketingCostPerYear')} min={0} max={10000} step={100} fmt={money0} />
              <Slider label="Hosting, printing & training / year" value={s.programFixedCostPerYear} onChange={set('programFixedCostPerYear')} min={0} max={10000} step={100} fmt={money0} />
            </div>
          </Panel>
          <Panel title="Off-peak bonus">
            <div className="space-y-4">
              <Slider label="Share of visits in bonus windows" value={s.offpeakShareOfVisits} onChange={set('offpeakShareOfVisits')} min={0} max={0.6} step={0.01} fmt={(v) => pct(v, 0)} />
              <Slider label="Average off-peak multiplier" value={s.offpeakAvgMultiplier} onChange={set('offpeakAvgMultiplier')} min={1} max={2} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} />
              <Slider label="Off-peak visits that are truly new" value={s.offpeakIncrementalShare} onChange={set('offpeakIncrementalShare')} min={0} max={1} step={0.05} fmt={(v) => pct(v, 0)} hint="The rest are guests shifting from busier times" />
              <Slider label="Value per visit moved out of peak" value={s.offpeakLaborSavingsPerShiftedVisit} onChange={set('offpeakLaborSavingsPerShiftedVisit')} min={0} max={10} step={0.5} fmt={money} hint="Shorter waits, fewer walk-aways at peak. Conservative default is $0" />
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          <div className={`rounded-3xl p-6 ${result.profitable ? 'bg-matcha text-white' : 'bg-beni text-white'}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Projected incremental contribution profit / year</div>
            <div className="mt-1 font-display text-5xl font-bold">{result.incrementalContribution < 0 ? '−' : ''}{money0(Math.abs(result.incrementalContribution))}</div>
            <div className="mt-2 text-sm opacity-90">
              {result.profitable ? 'Under these assumptions the program creates more contribution profit than it costs.' : 'Under these assumptions the program costs more than it earns. Lower the earn rate or costs, or raise engagement.'}
              {result.breakEvenVisitLift === 0 && ' It breaks even with no extra visits, because new off-peak guests alone cover the costs.'}
              {result.breakEvenVisitLift > 0 && ` Break-even visit lift: ${pct(result.breakEvenVisitLift)}.`}
              {result.breakEvenVisitLift == null && ' It does not break even at any visit lift up to 100%.'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Incremental revenue" value={money0(result.incrementalRevenue)} />
            <Stat label="Added contribution (pre-cost)" value={money0(result.grossProfitIncrement)} />
            <Stat label="Total reward cost" value={money0(result.rewardCost)} sub={`${pct(result.rewardCostShareOfRevenue, 2)} of member revenue`} />
            <Stat label="Effective reward rate" value={pct(result.rewardCostRate, 2)} sub="cost per $ before off-peak bonus" />
          </div>
          <Panel title="Scenario 1 vs Scenario 2" sub="Annual member revenue and contribution (after all program costs)">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={kfmt} width={48} />
                  <Tooltip formatter={(v) => money0(v)} />
                  <Legend />
                  <Bar dataKey="Revenue" fill={CHART.grid} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Contribution" fill={CHART.ink} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Where the profit comes from">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={waterfall}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={kfmt} width={48} />
                  <Tooltip formatter={(v) => money0(v)} />
                  <ReferenceLine y={0} stroke="#999" />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                    {waterfall.map((w, i) => <Cell key={i} fill={i === waterfall.length - 1 ? (w.v >= 0 ? CHART.matcha : CHART.beni) : w.v >= 0 ? CHART.ai : CHART.kin} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="table mt-3">
              <tbody>
                <tr><td>Scenario 1 revenue (no program)</td><td className="text-right">{money0(result.scenario1.revenue)}</td></tr>
                <tr><td>Scenario 2 revenue (with program)</td><td className="text-right">{money0(result.scenario2.revenue)}</td></tr>
                <tr><td>Incremental revenue × {pct(s.contributionMargin, 0)} CM</td><td className="text-right">{money0(result.grossProfitIncrement)}</td></tr>
                <tr><td>− Reward costs (standard + off-peak bonus)</td><td className="text-right">−{money0(result.rewardCost)}</td></tr>
                <tr><td>− Promotion/marketing and other costs</td><td className="text-right">−{money0(result.otherCosts)}</td></tr>
                <tr className="font-semibold"><td>= Incremental contribution profit</td><td className="text-right">{money0(result.incrementalContribution)}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">The reward cost applies to <i>all</i> member sales, including visits that would have happened anyway. That makes this a conservative model.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
