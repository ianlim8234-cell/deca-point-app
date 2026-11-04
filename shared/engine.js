// Core loyalty math. The server imports this module to make every authoritative
// calculation. The browser imports the same module for previews and the profitability
// simulator, so both always agree.
import { RECOMMENDED_WINDOWS } from './popularTimes.js';

export const TIMEZONE = 'America/Chicago'; // The Woodlands, TX

export const DEFAULT_SETTINGS = {
  restaurant: {
    name: 'Ema Japanese Cuisine',
    address: '6700 Woodlands Pkwy, Suite 250, The Woodlands, TX 77382',
    phone: '(281) 651-2542',
    orderUrl: 'https://pos.chowbus.com/online-ordering/store/Ema-Japanese-Cuisine/21424',
    timezone: TIMEZONE,
  },
  // SAMPLE thresholds from the project brief. They must be reviewed against real sales data.
  tiers: [
    { key: 'silver', name: 'Silver', minSpend: 0, rate: 10 },
    { key: 'gold', name: 'Gold', minSpend: 200, rate: 11 },
    { key: 'platinum', name: 'Platinum', minSpend: 500, rate: 12 },
  ],
  eligibility: {
    includeTax: false,
    includeTip: false,
    minPurchase: 5,
    excludedNote: 'Gift card purchases and alcohol are not eligible for points.',
  },
  expiration: {
    pointsExpireAfterInactiveMonths: 12, // 0 = never (requires legal review)
    rewardValidDays: 30,
  },
  offpeak: {
    enabled: true,
    suspended: false, // emergency switch for managers
    onePerCustomerPerDay: true, // stops one bill being split into many bonus visits
    windows: RECOMMENDED_WINDOWS.map((w, i) => ({ id: `w${i + 1}`, ...w })),
  },
  promotions: {
    allowStacking: false, // when false, only the highest multiplier applies
    maxMultiplier: 2,
  },
  finance: {
    // ASSUMPTIONS. Ema's actual cost data was not available. The owner should replace these.
    targetRewardCostRate: 0.02, // reward cost aimed at 2.0% of qualifying sales (Silver, standard hours)
    maxRewardCostRate: 0.03, // hard ceiling; anything above it gets flagged
    contributionMargin: 0.6, // 1 − (food 32% + variable labor/packaging/card fees 8%)
    fulfillmentCost: 0.25, // variable cost per redeemed item (packaging, prep time)
    breakageRate: 0.2, // share of issued points expected never to be redeemed
    monthlyRedemptionBudget: 2500, // food-cost dollars; marketplace pauses above this
    foodCostByCategory: {
      beverages: 0.2,
      appetizers: 0.3,
      sushi: 0.34,
      entrees: 0.32,
      specialty: 0.4,
      exclusive: 0.4,
    },
  },
  milestones: {
    // Points counted are those earned since the customer ENTERED the tier.
    // Thresholds are sized so every milestone is reachable before the next tier
    // (Silver spans $0–$200 ≈ 2,000 pts; Gold spans $200–$500 ≈ 3,300 pts).
    silver: [
      { key: 's1', points: 600, rewardId: 'soft-drink', label: 'Free Beverage' },
      { key: 's2', points: 1500, rewardId: 'edamame', label: 'Free Appetizer' },
    ],
    gold: [
      { key: 'g1', points: 1100, rewardId: 'japanese-soda', label: 'Free Japanese Soda' },
      { key: 'g2', points: 2750, rewardId: 'pork-gyoza', label: 'Free Hot Appetizer' },
    ],
    platinum: [
      { key: 'p1', points: 2400, rewardId: 'crispy-sushi-rice', label: 'Free Signature Appetizer' },
      { key: 'p2', points: 6000, rewardId: 'ema-roll', label: 'Premium Roll – The Ema Roll' },
    ],
    platinumRepeats: true, // Platinum has no next tier, so its milestones repeat every 6,000 points
  },
  streaks: {
    enabled: true,
    levels: [
      { visits: 2, points: 100 },
      { visits: 4, points: 250 },
      { visits: 6, points: 500 },
    ],
  },
  birthday: { enabled: true, rewardId: 'crispy-sushi-rice' },
  referral: { enabled: true, referrerPoints: 500, refereePoints: 250, minPurchase: 15 },
  terms:
    'Points are earned on eligible pre-tax food and non-alcoholic beverage purchases, excluding tips and gift cards, and rounded down to the nearest whole point. Points have no cash value. Membership tier is based on qualifying lifetime spending and does not drop when you redeem points. Rewards are valid for 30 days after they are issued, can be used once, and cannot be exchanged for cash. Off-peak bonuses apply only during posted windows, at most once per member per day, and may be suspended at any time. Points expire after 12 months without account activity. Ema Japanese Cuisine may change or end the program with 30 days’ notice. Draft terms: to be reviewed by legal counsel before launch.',
};

// ---------- time helpers ----------
export function localParts(date = new Date(), tz = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return {
    day: dayIdx,
    hour: Number(p.hour),
    minute: Number(p.minute),
    minutes: Number(p.hour) * 60 + Number(p.minute),
    date: `${p.year}-${p.month}-${p.day}`,
    month: `${p.year}-${p.month}`,
  };
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
}

export function activeOffpeakWindow(settings, date = new Date()) {
  const op = settings.offpeak;
  if (!op?.enabled || op.suspended) return null;
  const lp = localParts(date, settings.restaurant?.timezone);
  let best = null;
  for (const w of op.windows || []) {
    if (w.disabled) continue;
    if (Number(w.day) !== lp.day) continue;
    if (lp.minutes >= toMin(w.start) && lp.minutes < toMin(w.end)) {
      if (!best || w.multiplier > best.multiplier) best = w;
    }
  }
  return best;
}

export function activeCampaign(campaigns, tierKey, date = new Date()) {
  const t = date.getTime();
  let best = null;
  for (const c of campaigns || []) {
    if (c.status !== 'approved') continue;
    if (t < new Date(c.start_at).getTime() || t >= new Date(c.end_at).getTime()) continue;
    const tiers = typeof c.tiers === 'string' ? JSON.parse(c.tiers || '[]') : c.tiers || [];
    if (tiers.length && !tiers.includes(tierKey)) continue;
    if (!best || c.multiplier > best.multiplier) best = c;
  }
  return best;
}

// ---------- tiers ----------
export function sortedTiers(settings) {
  return [...settings.tiers].sort((a, b) => a.minSpend - b.minSpend);
}

export function tierFor(settings, lifetimeSpend) {
  const tiers = sortedTiers(settings);
  let cur = tiers[0];
  for (const t of tiers) if (lifetimeSpend + 1e-9 >= t.minSpend) cur = t;
  return cur;
}

export function nextTier(settings, tierKey) {
  const tiers = sortedTiers(settings);
  const i = tiers.findIndex((t) => t.key === tierKey);
  return tiers[i + 1] || null;
}

export function tierRank(settings, key) {
  return sortedTiers(settings).findIndex((t) => t.key === key);
}

// ---------- points calculation ----------
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Calculates points for one verified purchase.
 * Rules: eligible amount = subtotal (+ tax / tip only if configured); base points =
 * floor(eligible × tier rate). The off-peak and campaign multipliers apply to the base.
 * Unless stacking is allowed, only the highest multiplier is used, capped at maxMultiplier.
 * Bonus = floor(base × (multiplier − 1)).
 */
export function calculatePoints(settings, { subtotal, tax = 0, tip = 0, tierKey, offpeakWindow = null, campaign = null, offpeakAlreadyUsedToday = false }) {
  const el = settings.eligibility;
  let eligible = Number(subtotal) || 0;
  if (el.includeTax) eligible += Number(tax) || 0;
  if (el.includeTip) eligible += Number(tip) || 0;
  eligible = round2(Math.max(0, eligible));
  const tier = settings.tiers.find((t) => t.key === tierKey) || sortedTiers(settings)[0];
  const notes = [];
  if (eligible < el.minPurchase) {
    return { eligible, qualifies: false, rate: tier.rate, basePoints: 0, multiplier: 1, offpeakMultiplier: 1, promoMultiplier: 1, bonusPoints: 0, offpeakBonus: 0, promoBonus: 0, totalPoints: 0, notes: [`Below the $${el.minPurchase.toFixed(2)} minimum qualifying purchase`] };
  }
  const basePoints = Math.floor(eligible * tier.rate + 1e-9);
  let opMult = offpeakWindow ? Number(offpeakWindow.multiplier) : 1;
  if (offpeakWindow && offpeakAlreadyUsedToday && settings.offpeak.onePerCustomerPerDay) {
    opMult = 1;
    notes.push('Off-peak bonus already used today (limit 1 per day)');
  }
  const prMult = campaign ? Number(campaign.multiplier) : 1;
  const cap = settings.promotions.maxMultiplier || 2;
  let multiplier, offpeakBonus, promoBonus;
  if (settings.promotions.allowStacking) {
    multiplier = Math.min(cap, opMult * prMult);
  } else {
    multiplier = Math.min(cap, Math.max(opMult, prMult));
  }
  const bonusPoints = Math.floor(basePoints * (multiplier - 1) + 1e-9);
  // Credit the bonus to whichever source produced the multiplier.
  if (multiplier === 1) {
    offpeakBonus = 0;
    promoBonus = 0;
  } else if (!settings.promotions.allowStacking) {
    if (opMult >= prMult) {
      offpeakBonus = bonusPoints;
      promoBonus = 0;
    } else {
      offpeakBonus = 0;
      promoBonus = bonusPoints;
    }
  } else {
    const opShare = opMult > 1 ? Math.floor(basePoints * (Math.min(cap, opMult) - 1)) : 0;
    offpeakBonus = Math.min(bonusPoints, opShare);
    promoBonus = bonusPoints - offpeakBonus;
  }
  if (opMult > 1 && prMult > 1 && !settings.promotions.allowStacking) notes.push('Multipliers do not stack; the highest one was applied');
  return {
    eligible,
    qualifies: true,
    rate: tier.rate,
    basePoints,
    multiplier,
    offpeakMultiplier: opMult,
    promoMultiplier: prMult,
    bonusPoints,
    offpeakBonus,
    promoBonus,
    totalPoints: basePoints + bonusPoints,
    notes,
  };
}

// ---------- reward economics ----------
export function rewardCost(settings, item) {
  const fc = item.foodCostPct ?? settings.finance.foodCostByCategory[item.category] ?? 0.32;
  return round2(item.price * fc + (settings.finance.fulfillmentCost || 0));
}

/**
 * Formula-based point price:
 *   points = ceil50( variableCost ÷ targetRewardCostRate × SilverPointsPerDollar )
 * In words: the qualifying spend a Silver member needs before redeeming must be large
 * enough that the reward's variable cost is at most `targetRewardCostRate` of that spend.
 */
export function formulaPoints(settings, item) {
  const base = sortedTiers(settings)[0].rate;
  const cost = rewardCost(settings, item);
  const spendNeeded = cost / settings.finance.targetRewardCostRate;
  return Math.max(50, Math.ceil((spendNeeded * base) / 50) * 50);
}

export function rewardPoints(settings, item) {
  return item.pointsOverride ? Number(item.pointsOverride) : formulaPoints(settings, item);
}

/** Economics for one reward at every tier and at off-peak multipliers. */
export function rewardEconomics(settings, item) {
  const points = rewardPoints(settings, item);
  const cost = rewardCost(settings, item);
  const tiers = sortedTiers(settings).map((t) => {
    const spend = points / t.rate;
    return { key: t.key, name: t.name, spendNeeded: round2(spend), costRate: cost / spend, retailRate: item.price / spend };
  });
  const silver = tiers[0];
  const worst = tiers[tiers.length - 1];
  const flagged = worst.costRate > settings.finance.maxRewardCostRate;
  return { points, cost, tiers, silverCostRate: silver.costRate, worstCostRate: worst.costRate, flagged };
}

/** Average variable cost carried by each point, used to estimate point liability. */
export function costPerPoint(settings, items) {
  const list = items.filter((i) => i.active !== false && i.active !== 0);
  if (!list.length) return settings.finance.targetRewardCostRate / sortedTiers(settings)[0].rate;
  let sum = 0;
  for (const it of list) sum += rewardCost(settings, it) / rewardPoints(settings, it);
  return sum / list.length;
}

// ---------- milestones ----------
export function milestoneStatus(settings, tierKey, pointsInTier) {
  const list = [...(settings.milestones[tierKey] || [])].sort((a, b) => a.points - b.points);
  if (!list.length) return { list: [], cycle: 0, progressPoints: pointsInTier, next: null };
  const cycleLen = list[list.length - 1].points;
  const repeats = tierKey === sortedTiers(settings).at(-1).key && settings.milestones.platinumRepeats;
  let cycle = 0;
  let progress = pointsInTier;
  if (repeats && cycleLen > 0) {
    cycle = Math.floor(pointsInTier / cycleLen);
    progress = pointsInTier - cycle * cycleLen;
  }
  const next = list.find((m) => m.points > progress) || null;
  const prev = [...list].reverse().find((m) => m.points <= progress);
  return { list, cycle, cycleLen, repeats, progressPoints: progress, next, prevPoints: prev ? prev.points : 0 };
}

// ---------- profitability simulator ----------
/**
 * Compares a member's economics without and with the program.
 *  Scenario 1: baseline visits × avg check.
 *  Scenario 2: (baseline + extra visits) × (avg check × (1 + lift)), plus off-peak shifts.
 * Incremental contribution = incremental revenue × CM − reward cost − promo cost − other costs.
 */
export function simulate(input) {
  const {
    members, // active members
    baselineVisitsPerYear,
    avgCheck,
    visitLiftPct, // extra visits from loyalty, e.g. 0.1 = +10%
    checkLiftPct, // higher spend per visit, e.g. 0.05
    contributionMargin,
    rewardCostRate, // variable reward cost as % of member sales (after breakage)
    offpeakShareOfVisits, // share of member visits that earn an off-peak bonus
    offpeakAvgMultiplier, // e.g. 1.6
    offpeakIncrementalShare, // share of off-peak visits that are truly NEW (not shifted)
    offpeakLaborSavingsPerShiftedVisit, // value of moving a visit out of the peak (optional, usually 0)
    programFixedCostPerYear, // hosting, printing, staff training
    marketingCostPerYear,
  } = input;

  const baseRevenue = members * baselineVisitsPerYear * avgCheck;
  const visitsWith = baselineVisitsPerYear * (1 + visitLiftPct);
  const checkWith = avgCheck * (1 + checkLiftPct);
  const memberRevenueWith = members * visitsWith * checkWith;

  // Off-peak visits that are new add revenue and contribution beyond the loyalty lift.
  const opVisits = members * visitsWith * offpeakShareOfVisits;
  const opIncrementalRevenue = opVisits * offpeakIncrementalShare * checkWith;
  const revenueWith = memberRevenueWith + opIncrementalRevenue;

  const incrementalRevenue = revenueWith - baseRevenue;
  const grossProfitIncrement = incrementalRevenue * contributionMargin; // before program costs

  const standardRewardCost = memberRevenueWith * rewardCostRate;
  const offpeakExtraRewardCost = opVisits * checkWith * rewardCostRate * (offpeakAvgMultiplier - 1);
  const rewardCost = standardRewardCost + offpeakExtraRewardCost;
  const otherBenefit = opVisits * (1 - offpeakIncrementalShare) * (offpeakLaborSavingsPerShiftedVisit || 0);

  const incrementalContribution = grossProfitIncrement - rewardCost - marketingCostPerYear - programFixedCostPerYear + otherBenefit;

  // Smallest visit lift at which the program breaks even, holding everything else fixed.
  let breakEvenVisitLift = null;
  for (let l = 0; l <= 1; l += 0.0025) {
    const v = baselineVisitsPerYear * (1 + l);
    const mr = members * v * checkWith;
    const opv = members * v * offpeakShareOfVisits;
    const rev = mr + opv * offpeakIncrementalShare * checkWith;
    const ic = (rev - baseRevenue) * contributionMargin - (mr * rewardCostRate + opv * checkWith * rewardCostRate * (offpeakAvgMultiplier - 1)) - marketingCostPerYear - programFixedCostPerYear + opv * (1 - offpeakIncrementalShare) * (offpeakLaborSavingsPerShiftedVisit || 0);
    if (ic >= 0) {
      breakEvenVisitLift = l;
      break;
    }
  }

  return {
    scenario1: { revenue: baseRevenue, contribution: baseRevenue * contributionMargin },
    scenario2: { revenue: revenueWith, contribution: revenueWith * contributionMargin - rewardCost - marketingCostPerYear - programFixedCostPerYear + otherBenefit },
    incrementalRevenue,
    grossProfitIncrement,
    rewardCost,
    standardRewardCost,
    offpeakExtraRewardCost,
    otherCosts: marketingCostPerYear + programFixedCostPerYear,
    incrementalContribution,
    rewardCostShareOfRevenue: rewardCost / revenueWith,
    breakEvenVisitLift,
    profitable: incrementalContribution > 0,
  };
}
