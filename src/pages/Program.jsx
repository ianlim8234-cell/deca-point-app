import { Link } from 'react-router-dom';
import { useConfig } from '../lib/auth.jsx';
import { PublicNav } from './Landing.jsx';
import { BaselineHeatmap } from '../components/Heatmap.jsx';
import { PEAK_SUMMARY, RECOMMENDED_WINDOWS } from '../../shared/popularTimes.js';
import { DEFAULT_SETTINGS, formulaPoints, rewardCost, fmtTime } from '../../shared/engine.js';
import { MENU } from '../../shared/menu.js';
import { money, money0, pct, pts, DAY_SHORT } from '../lib/format.js';

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-1 font-display text-3xl font-bold">{title}</h2>
      <div className="mt-4 space-y-4 text-ink-2">{children}</div>
    </section>
  );
}

export default function Program() {
  const { config } = useConfig();
  const s = DEFAULT_SETTINGS;
  const sample = ['soft-drink', 'edamame', 'pork-gyoza', 'crispy-sushi-rice', 'spicy-tuna-roll', 'ema-roll', 'sashimi-combo'].map((id) => MENU.find((m) => m.id === id));
  const windows = config?.offpeak?.windows || RECOMMENDED_WINDOWS;
  return (
    <div className="min-h-screen bg-washi">
      <div className="seigaiha relative pb-14 pt-28 text-washi">
        <PublicNav />
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="eyebrow text-washi/60">DECA Hospitality & Tourism Operations Research</div>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">The Ema Rewards business case</h1>
          <p className="mt-3 max-w-2xl text-washi/75">An intelligent, tier-based loyalty platform that rewards repeat visits and moves demand into Ema Japanese Cuisine’s quieter hours, while capping reward cost so every point stays profitable.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {[['problem', 'Problem'], ['solution', 'Solution'], ['offpeak', 'Off-peak analysis'], ['economics', 'Economics'], ['controls', 'Safeguards'], ['terms', 'Terms']].map(([id, l]) => (
              <a key={id} href={`#${id}`} className="rounded-full border border-washi/20 px-3 py-1 hover:bg-washi/10">{l}</a>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-14 sm:px-6">
        <Section id="problem" eyebrow="01 · Business problem" title="Uneven traffic and limited repeat engagement">
          <p>
            Ema’s own popular-times data shows a clear pattern. Friday and Saturday evenings reach 73–94% of peak capacity, while weekday openings and late evenings sit at 22–40%. During those quiet hours,
            staff, rent and utilities are already paid for, so empty seats mean lost contribution. Ema also has no structured way to recognize regulars or to measure repeat visits.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4"><div className="font-display text-3xl font-bold text-beni">94</div><div className="text-sm text-ink-3">Fri 6 PM busyness index, the weekly peak</div></div>
            <div className="card p-4"><div className="font-display text-3xl font-bold text-matcha">22</div><div className="text-sm text-ink-3">Mon 9 PM, the quietest hour (23% of peak)</div></div>
            <div className="card p-4"><div className="font-display text-3xl font-bold">{RECOMMENDED_WINDOWS.length}</div><div className="text-sm text-ink-3">quiet windows found across the week</div></div>
          </div>
        </Section>

        <Section id="solution" eyebrow="02 · Proposed solution" title="Earn more as you stay loyal. Earn extra when it’s calm.">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="card p-4"><b>Three tiers:</b> Silver 10, Gold 11 and Platinum 12 points per $1, based on lifetime qualifying spend (sample thresholds $0 / {money0(s.tiers[1].minSpend)} / {money0(s.tiers[2].minSpend)}).</li>
            <li className="card p-4"><b>Quiet Hours Bonus:</b> 1.5× or 2× points only in windows the data shows are slow, at most once per member per day.</li>
            <li className="card p-4"><b>Milestone gifts</b> unlock automatically inside each tier, from a free drink at 600 pts up to The Ema Roll for Platinum.</li>
            <li className="card p-4"><b>Real-menu marketplace:</b> each reward’s point price comes from menu price and food cost, not set arbitrarily.</li>
            <li className="card p-4"><b>Ema Exclusive:</b> the owner personally rewards top, off-peak and at-risk guests, which builds relationships instead of discount habits.</li>
            <li className="card p-4"><b>Secure QR check-in:</b> signed, rotating member codes. Staff record verified purchases and every point has a ledger entry.</li>
          </ul>
        </Section>

        <Section id="offpeak" eyebrow="03 · Evidence-based off-peak schedule" title="Built from the popular-times screenshots">
          <p className="text-sm">
            We read every bar on the seven Google “Popular times” charts and converted its height to an index from 0 to 100, with Friday 6 PM, the busiest bar, at about 94. Hours at 40 or below are slow (1.5× candidates). Hours at 30 or below are
            very slow (2× candidates). Hours at 60 or above are never rewarded. Outlined cells are the resulting bonus windows.
          </p>
          <div className="card p-4"><BaselineHeatmap windows={windows} /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-4">
              <div className="font-semibold">Recommended windows</div>
              <ul className="mt-2 space-y-1 text-sm">
                {RECOMMENDED_WINDOWS.map((w, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{DAY_SHORT[w.day]} {fmtTime(w.start)}–{fmtTime(w.end)} <span className="text-ink-4">({w.evidence})</span></span><b>{w.multiplier}×</b></li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <div className="font-semibold">Deliberately excluded (already busy)</div>
              <ul className="mt-2 space-y-1 text-sm">{PEAK_SUMMARY.map((p) => <li key={p}>• {p}</li>)}</ul>
              <div className="mt-4 font-semibold">Limitations</div>
              <p className="mt-1 text-sm text-ink-3">Google’s index is relative and approximate (we read it to about ±3 points). Before launch, check it against Ema’s POS covers by hour, staffing and table capacity. The owner can edit every window from the dashboard.</p>
            </div>
          </div>
        </Section>

        <Section id="economics" eyebrow="04 · Reward economics" title="Points are priced so rewards cost about 2% of sales">
          <p className="text-sm">
            Points issued are not dollars of value. Each reward is priced with <code className="rounded bg-paper px-1">points = ceil₅₀((menu price × food cost % + ${s.finance.fulfillmentCost} fulfillment) ÷ {pct(s.finance.targetRewardCostRate)} × 10)</code>, so a Silver member spends about 50× the reward’s variable cost before redeeming it.
            Food-cost percentages are labeled assumptions ({Object.entries(s.finance.foodCostByCategory).map(([k, v]) => `${k} ${pct(v, 0)}`).join(', ')}), and the owner can edit them.
          </p>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Reward</th><th className="text-right">Menu price</th><th className="text-right">Variable cost</th><th className="text-right">Points</th><th className="text-right">Silver spend needed</th><th className="text-right">Retail value back</th></tr></thead>
              <tbody>
                {sample.map((m) => {
                  const p = formulaPoints(s, m);
                  return (
                    <tr key={m.id}>
                      <td className="font-semibold">{m.name}{m.priceStatus !== 'verified' && <span className="ml-1 text-xs text-kin">*</span>}</td>
                      <td className="text-right">{money(m.price)}</td>
                      <td className="text-right">{money(rewardCost(s, m))}</td>
                      <td className="text-right">{pts(p)}</td>
                      <td className="text-right">{money(p / 10)}</td>
                      <td className="text-right">{pct(m.price / (p / 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 text-xs text-ink-4">* price from a third-party listing; to be confirmed against the in-store menu.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {s.tiers.map((t) => (
              <div key={t.key} className={`tier-${t.key} rounded-2xl p-4`}>
                <div className="font-display text-xl font-bold">{t.name}</div>
                <div className="text-sm opacity-80">{t.rate} pts / $1</div>
                <div className="mt-2 text-sm">Reward cost ≈ <b>{pct(t.rate * 0.002, 1)}</b> of sales<br />at 2× off-peak ≈ <b>{pct(t.rate * 0.004, 1)}</b></div>
              </div>
            ))}
          </div>
          <p className="text-sm">
            <b>Why off-peak bonuses pay:</b> a guest who arrives at 3 PM Wednesday instead of not at all brings about {pct(s.finance.contributionMargin, 0)} contribution margin at a reward cost of 4–5%. Even if only 40% of bonus visits are new
            (the rest shifted from busier hours), the bonus earns back its cost and eases weekend wait times. The owner’s Profit Simulator models this with every assumption visible.
          </p>
        </Section>

        <Section id="controls" eyebrow="05 · Financial & security safeguards" title="Built to scale without uncontrolled obligations">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              `Maximum reward cost rate (${pct(s.finance.maxRewardCostRate)}). Rewards over it are flagged automatically.`,
              `Monthly redemption budget (${money0(s.finance.monthlyRedemptionBudget)} food cost). The marketplace pauses when it is reached.`,
              `Promotions are capped at ${s.promotions.maxMultiplier}×, never stack, and need owner approval.`,
              'One-tap suspension of off-peak bonuses for managers.',
              'Points are earned only on staff-verified purchases; customers cannot add purchases.',
              'Each check number can post only once a day, and duplicate submissions are blocked with idempotency keys.',
              'QR codes are signed tokens that expire after 10 minutes and contain no personal data.',
              'Every point change has a ledger entry, and reversals keep the original record plus an audit trail.',
              'Role-based access for customer, employee, manager and owner.',
              `Point expiry after ${s.expiration.pointsExpireAfterInactiveMonths} inactive months and reward codes valid for ${s.expiration.rewardValidDays} days (legal review pending).`,
            ].map((t) => <li key={t} className="card p-3">✓ {t}</li>)}
          </ul>
        </Section>

        <Section id="terms" eyebrow="06 · Program terms (draft)" title="Ema Rewards terms">
          <p className="card p-4 text-sm leading-relaxed">{config?.terms || s.terms}</p>
        </Section>

        <div className="flex flex-wrap gap-3">
          <Link to="/join" className="btn-beni btn-lg">Try it as a customer</Link>
          <Link to="/staff" className="btn-outline btn-lg">Staff scanner</Link>
          <Link to="/admin" className="btn-primary btn-lg">Owner dashboard</Link>
        </div>
        <p className="text-xs text-ink-4">
          Data sources: Ema’s Google popular-times screenshots (supplied by the project team); menu items and prices from emajapanesecuisine.com, Ema’s Chowbus store and third-party listings (Nov 2026). Demonstration customers and transactions are hypothetical and labeled as such.
        </p>
      </main>
    </div>
  );
}
