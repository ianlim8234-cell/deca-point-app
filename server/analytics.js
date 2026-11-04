import { db, getProgram, allRewards } from './db.js';
import { costPerPoint, rewardEconomics, sortedTiers, tierFor } from '../shared/engine.js';
import { POPULAR_TIMES } from '../shared/popularTimes.js';
import { monthRedemptionCost } from './loyalty.js';

const DAY = 864e5;

export function analytics({ includeDemo = true } = {}) {
  const settings = getProgram();
  const demoClause = includeDemo ? '' : ' AND is_demo = 0';
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  const customers = db.prepare(`SELECT * FROM users WHERE role = 'customer'${demoClause}`).all();
  const txs = db.prepare(`SELECT * FROM transactions WHERE status = 'posted'${demoClause}`).all();
  const ledger = db.prepare(`SELECT customer_id, delta, kind, created_at FROM ledger WHERE 1=1${demoClause}`).all();
  const reds = db.prepare(`SELECT * FROM redemptions WHERE 1=1${demoClause}`).all();
  const rewards = allRewards();
  const cpp = costPerPoint(settings, rewards);
  const fin = settings.finance;

  // ---- per-customer rollups
  const byCust = new Map(customers.map((c) => [c.id, { c, spend: 0, visits: 0, days: new Set(), last: null, first: null, op: 0, balance: 0, earned: 0 }]));
  for (const t of txs) {
    const r = byCust.get(t.customer_id);
    if (!r) continue;
    r.spend += t.eligible_amount;
    r.visits += 1;
    r.days.add(t.local_date);
    if (!r.last || t.created_at > r.last) r.last = t.created_at;
    if (!r.first || t.created_at < r.first) r.first = t.created_at;
    if (t.offpeak_bonus > 0) r.op += 1;
  }
  const earnKinds = new Set(['purchase', 'offpeak_bonus', 'promo_bonus', 'streak', 'referral', 'adjustment', 'reversal']);
  let pointsIssued = 0,
    pointsRedeemed = 0,
    pointsExpired = 0;
  for (const l of ledger) {
    const r = byCust.get(l.customer_id);
    if (r) {
      r.balance += l.delta;
      if (earnKinds.has(l.kind)) r.earned += l.delta;
    }
    if (earnKinds.has(l.kind)) pointsIssued += l.delta;
    if (l.kind === 'redemption') pointsRedeemed += -l.delta;
    if (l.kind === 'refund') pointsRedeemed -= l.delta;
    if (l.kind === 'expiration') pointsExpired += -l.delta;
  }
  const rows = [...byCust.values()];
  const withVisits = rows.filter((r) => r.visits > 0);
  const active = rows.filter((r) => r.last && now - new Date(r.last).getTime() < 60 * DAY);
  const repeat = withVisits.filter((r) => r.days.size >= 2);
  const totalSales = txs.reduce((s, t) => s + t.eligible_amount, 0);
  const avgCheck = txs.length ? totalSales / txs.length : 0;

  // Purchase frequency: visits per active month of membership.
  let freqSum = 0;
  for (const r of withVisits) {
    const months = Math.max(1, (now - new Date(r.first).getTime()) / (30 * DAY));
    freqSum += r.visits / months;
  }
  const visitsPerMonth = withVisits.length ? freqSum / withVisits.length : 0;
  const annualValue = avgCheck * visitsPerMonth * 12;
  const ASSUMED_LIFETIME_YEARS = 3; // assumption, editable later
  const projectedCLV = annualValue * ASSUMED_LIFETIME_YEARS * fin.contributionMargin * (1 - fin.targetRewardCostRate / fin.contributionMargin);

  const outstanding = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const liability = outstanding * cpp * (1 - fin.breakageRate);
  const usedReds = reds.filter((r) => r.status === 'used' || r.status === 'issued');
  const rewardCostTotal = usedReds.reduce((s, r) => s + r.est_cost, 0);
  const offpeakTx = txs.filter((t) => t.offpeak_bonus > 0);
  const offpeakSales = offpeakTx.reduce((s, t) => s + t.eligible_amount, 0);
  const offpeakBonusPts = txs.reduce((s, t) => s + t.offpeak_bonus, 0);
  const promoBonusPts = txs.reduce((s, t) => s + t.promo_bonus, 0);

  // Reward cost on an accrual basis: points issued × cost per point × expected redemption rate.
  const accruedRewardCost = pointsIssued * cpp * (1 - fin.breakageRate);
  const contributionBeforeRewards = totalSales * fin.contributionMargin;
  const contributionAfterRewards = contributionBeforeRewards - accruedRewardCost;

  // ---- tier distribution & profitability by tier
  const tiers = sortedTiers(settings).map((t) => ({ key: t.key, name: t.name, rate: t.rate, members: 0, sales: 0, points: 0 }));
  const tierIdx = Object.fromEntries(tiers.map((t, i) => [t.key, i]));
  for (const r of rows) {
    const key = tierFor(settings, r.spend).key;
    tiers[tierIdx[key]].members += 1;
  }
  for (const t of txs) {
    const i = tierIdx[t.tier_key] ?? 0;
    tiers[i].sales += t.eligible_amount;
    tiers[i].points += t.total_points;
  }
  for (const t of tiers) {
    t.rewardCost = t.points * cpp * (1 - fin.breakageRate);
    t.contribution = t.sales * fin.contributionMargin - t.rewardCost;
    t.costRate = t.sales ? t.rewardCost / t.sales : 0;
  }

  // ---- by promotional period
  const periods = { standard: { label: 'Standard hours', sales: 0, visits: 0, points: 0 }, offpeak: { label: 'Off-peak bonus', sales: 0, visits: 0, points: 0 }, promo: { label: 'Promotional campaign', sales: 0, visits: 0, points: 0 } };
  for (const t of txs) {
    const k = t.offpeak_bonus > 0 ? 'offpeak' : t.promo_bonus > 0 ? 'promo' : 'standard';
    periods[k].sales += t.eligible_amount;
    periods[k].visits += 1;
    periods[k].points += t.total_points;
  }
  for (const p of Object.values(periods)) {
    p.rewardCost = p.points * cpp * (1 - fin.breakageRate);
    p.contribution = p.sales * fin.contributionMargin - p.rewardCost;
    p.costRate = p.sales ? p.rewardCost / p.sales : 0;
  }

  // ---- off-peak heatmap: visits by day × hour, compared with the Google baseline
  const heat = {};
  const revenueByHour = {};
  for (let d = 0; d < 7; d++) heat[d] = {};
  for (const t of txs) {
    heat[t.local_day][t.local_hour] = (heat[t.local_day][t.local_hour] || 0) + 1;
    revenueByHour[t.local_hour] = (revenueByHour[t.local_hour] || 0) + t.eligible_amount;
  }

  // Off-peak window revenue: last 30 days vs the 30 days before
  const inWindow = (t) => t.offpeak_window != null;
  const sumSales = (list) => list.reduce((s, t) => s + t.eligible_amount, 0);
  const last30 = txs.filter((t) => now - new Date(t.created_at).getTime() < 30 * DAY);
  const prev30 = txs.filter((t) => {
    const a = now - new Date(t.created_at).getTime();
    return a >= 30 * DAY && a < 60 * DAY;
  });
  const offpeakTrend = {
    last30: sumSales(last30.filter(inWindow)),
    prev30: sumSales(prev30.filter(inWindow)),
    last30Share: sumSales(last30) ? sumSales(last30.filter(inWindow)) / sumSales(last30) : 0,
    prev30Share: sumSales(prev30) ? sumSales(prev30.filter(inWindow)) / sumSales(prev30) : 0,
  };

  // ---- monthly trend
  const monthly = {};
  for (const t of txs) {
    const m = t.local_date.slice(0, 7);
    monthly[m] ??= { month: m, sales: 0, visits: 0, offpeakSales: 0, members: new Set() };
    monthly[m].sales += t.eligible_amount;
    monthly[m].visits += 1;
    if (t.offpeak_bonus > 0) monthly[m].offpeakSales += t.eligible_amount;
    monthly[m].members.add(t.customer_id);
  }
  const monthlyArr = Object.values(monthly)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, members: m.members.size }));

  // ---- segmentation, engagement and recognition
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  const people = rows.map((r) => {
    const daysSince = r.last ? (now - new Date(r.last).getTime()) / DAY : null;
    const recency = daysSince == null ? 0 : Math.max(0, 1 - daysSince / 90);
    const freq = Math.min(1, r.days.size / 12);
    const monetary = r.spend / maxSpend;
    const opShare = r.visits ? r.op / r.visits : 0;
    const score = Math.round(recency * 40 + freq * 30 + monetary * 20 + opShare * 10);
    let segment = 'New';
    if (!r.visits) segment = 'Not yet visited';
    else if (daysSince > 90) segment = 'Lapsed';
    else if (daysSince > 45 && r.days.size >= 2) segment = 'At risk';
    else if (tierFor(settings, r.spend).key === sortedTiers(settings).at(-1).key) segment = 'VIP';
    else if (r.days.size >= 2) segment = 'Regular';
    return {
      id: r.c.id,
      memberId: r.c.member_id,
      name: `${r.c.first_name} ${r.c.last_name}`,
      tier: tierFor(settings, r.spend).name,
      spend: r.spend,
      visits: r.visits,
      offpeakVisits: r.op,
      balance: r.balance,
      lastVisit: r.last,
      memberSince: r.c.created_at,
      daysSince: daysSince == null ? null : Math.round(daysSince),
      score,
      segment,
      isDemo: !!r.c.is_demo,
    };
  });
  const segments = {};
  for (const p of people) segments[p.segment] = (segments[p.segment] || 0) + 1;
  const top = (key, n = 8) => [...people].sort((a, b) => b[key] - a[key]).filter((p) => p[key] > 0).slice(0, n);
  const longest = [...people].sort((a, b) => a.memberSince.localeCompare(b.memberSince)).slice(0, 8);
  const atRisk = people.filter((p) => p.segment === 'At risk').sort((a, b) => b.spend - a.spend);

  // ---- redemption forecast: recent burn rate × cost per point
  const recentRedeemed = ledger.filter((l) => l.kind === 'redemption' && now - new Date(l.created_at).getTime() < 90 * DAY).reduce((s, l) => s - l.delta, 0);
  const forecast90 = { points: recentRedeemed, cost: recentRedeemed * cpp };

  // ---- reward economics flags
  const rewardFlags = rewards
    .filter((r) => r.active)
    .map((r) => ({ id: r.id, name: r.name, ...rewardEconomics(settings, r) }))
    .filter((r) => r.flagged);

  // ---- automated recommendations (rule-based)
  const recs = [];
  if (atRisk.length) recs.push({ kind: 'win-back', text: `${atRisk.length} regular guest(s) have not visited in 45+ days. Consider a personal Owner’s Reward or a targeted 1.5× week.` });
  const budgetUsed = monthRedemptionCost() / fin.monthlyRedemptionBudget;
  if (budgetUsed > 0.8) recs.push({ kind: 'budget', text: `${Math.round(budgetUsed * 100)}% of this month’s redemption budget is used. Review the budget or pause high-cost rewards.` });
  const opShareAll = totalSales ? offpeakSales / totalSales : 0;
  if (opShareAll < 0.15) recs.push({ kind: 'offpeak', text: `Only ${(opShareAll * 100).toFixed(0)}% of member sales earned an off-peak bonus. Promote the 2× windows (Mon 9 PM, Tue/Wed 11 AM, Wed 9 PM) at the host stand and on receipts.` });
  if (rewardFlags.length) recs.push({ kind: 'cost', text: `${rewardFlags.length} reward(s) exceed the ${(fin.maxRewardCostRate * 100).toFixed(1)}% maximum cost rate for Platinum members. Raise their point prices.` });
  const weakTier = tiers.find((t) => t.sales > 0 && t.costRate > fin.maxRewardCostRate);
  if (weakTier) recs.push({ kind: 'tier', text: `${weakTier.name} reward cost is ${(weakTier.costRate * 100).toFixed(1)}% of sales, which is above the limit. Consider adjusting its earn rate.` });
  if (!recs.length) recs.push({ kind: 'ok', text: 'All program metrics are within the configured financial limits.' });

  return {
    generatedAt: iso(now),
    includeDemo,
    hasDemo: !!db.prepare('SELECT 1 FROM users WHERE is_demo = 1 LIMIT 1').get(),
    customers: {
      total: customers.length,
      active: active.length,
      new30: customers.filter((c) => now - new Date(c.created_at).getTime() < 30 * DAY).length,
      repeatPct: withVisits.length ? repeat.length / withVisits.length : 0,
      avgCheck,
      avgSpendPerCustomer: withVisits.length ? totalSales / withVisits.length : 0,
      visitsPerMonth,
      annualValue,
      projectedCLV,
      clvAssumptionYears: ASSUMED_LIFETIME_YEARS,
    },
    tiers,
    finance: {
      totalSales,
      visits: txs.length,
      pointsIssued,
      pointsRedeemed,
      pointsExpired,
      outstanding,
      costPerPoint: cpp,
      liability,
      rewardCostTotal,
      avgRewardCost: usedReds.length ? rewardCostTotal / usedReds.length : 0,
      accruedRewardCost,
      contributionBeforeRewards,
      contributionAfterRewards,
      rewardCostRate: totalSales ? accruedRewardCost / totalSales : 0,
      offpeakSales,
      offpeakBonusPts,
      promoBonusPts,
      monthRedemptionCost: monthRedemptionCost(),
      monthlyBudget: fin.monthlyRedemptionBudget,
    },
    periods,
    offpeak: {
      heat,
      baseline: POPULAR_TIMES,
      revenueByHour,
      participation: withVisits.length ? withVisits.filter((r) => r.op > 0).length / withVisits.length : 0,
      trend: offpeakTrend,
    },
    monthly: monthlyArr,
    segments,
    recognition: { frequent: top('visits'), spenders: top('spend'), offpeak: top('offpeakVisits'), longest, atRisk: atRisk.slice(0, 10), engaged: top('score') },
    forecast90,
    rewardFlags,
    recommendations: recs,
  };
}
