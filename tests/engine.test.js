import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, calculatePoints, tierFor, activeOffpeakWindow, formulaPoints, rewardEconomics, milestoneStatus, simulate } from '../shared/engine.js';
import { MENU } from '../shared/menu.js';

const S = structuredClone(DEFAULT_SETTINGS);

test('base points per tier match the brief ($40 → 400 / 440 / 480)', () => {
  assert.equal(calculatePoints(S, { subtotal: 40, tierKey: 'silver' }).totalPoints, 400);
  assert.equal(calculatePoints(S, { subtotal: 40, tierKey: 'gold' }).totalPoints, 440);
  assert.equal(calculatePoints(S, { subtotal: 40, tierKey: 'platinum' }).totalPoints, 480);
});

test('off-peak 1.5× on $30 Silver = 450 (brief example)', () => {
  const r = calculatePoints(S, { subtotal: 30, tierKey: 'silver', offpeakWindow: { multiplier: 1.5 } });
  assert.equal(r.basePoints, 300);
  assert.equal(r.offpeakBonus, 150);
  assert.equal(r.totalPoints, 450);
});

test('tax and tips excluded by default; rounding down', () => {
  const r = calculatePoints(S, { subtotal: 12.37, tax: 1.02, tip: 3, tierKey: 'gold' });
  assert.equal(r.eligible, 12.37);
  assert.equal(r.basePoints, 136); // 12.37 × 11 = 136.07
});

test('minimum qualifying purchase enforced', () => {
  const r = calculatePoints(S, { subtotal: 4.99, tierKey: 'silver' });
  assert.equal(r.qualifies, false);
  assert.equal(r.totalPoints, 0);
});

test('multipliers do not stack and are capped', () => {
  const r = calculatePoints(S, { subtotal: 100, tierKey: 'silver', offpeakWindow: { multiplier: 1.5 }, campaign: { multiplier: 2, name: 'x' } });
  assert.equal(r.multiplier, 2);
  assert.equal(r.totalPoints, 2000);
  assert.equal(r.promoBonus, 1000);
  assert.equal(r.offpeakBonus, 0);
});

test('off-peak bonus limited to once per day', () => {
  const r = calculatePoints(S, { subtotal: 50, tierKey: 'silver', offpeakWindow: { multiplier: 2 }, offpeakAlreadyUsedToday: true });
  assert.equal(r.totalPoints, 500);
});

test('tier is based on lifetime spend', () => {
  assert.equal(tierFor(S, 0).key, 'silver');
  assert.equal(tierFor(S, 199.99).key, 'silver');
  assert.equal(tierFor(S, 200).key, 'gold');
  assert.equal(tierFor(S, 500).key, 'platinum');
});

test('off-peak windows: Mon 9 PM Central is 2×, Fri 7 PM is not rewarded', () => {
  // 2026-11-02 is a Monday. 9:30 PM CST = 03:30 UTC next day.
  assert.equal(activeOffpeakWindow(S, new Date('2026-11-03T03:30:00Z'))?.multiplier, 2);
  // 2026-11-06 Friday 7 PM CST = 01:00 UTC Saturday
  assert.equal(activeOffpeakWindow(S, new Date('2026-11-07T01:00:00Z')), null);
  const sus = structuredClone(S);
  sus.offpeak.suspended = true;
  assert.equal(activeOffpeakWindow(sus, new Date('2026-11-03T03:30:00Z')), null);
});

test('reward pricing formula keeps Silver cost at or under the target rate', () => {
  for (const m of MENU) {
    const e = rewardEconomics(S, m);
    assert.ok(e.silverCostRate <= S.finance.targetRewardCostRate + 1e-9, `${m.name} ${e.silverCostRate}`);
    assert.ok(e.points % 50 === 0);
  }
  assert.equal(formulaPoints(S, MENU.find((m) => m.id === 'edamame')), 900);
});

test('milestones reachable within tier spans and Platinum repeats', () => {
  const silverSpan = (S.tiers[1].minSpend - S.tiers[0].minSpend) * S.tiers[0].rate;
  assert.ok(Math.max(...S.milestones.silver.map((m) => m.points)) <= silverSpan);
  const st = milestoneStatus(S, 'platinum', 6000 + 2500);
  assert.equal(st.cycle, 1);
  assert.equal(st.progressPoints, 2500);
  assert.equal(st.next.key, 'p2');
});

test('simulator: zero lift with costs is unprofitable; reasonable lift is profitable', () => {
  const base = { members: 500, baselineVisitsPerYear: 6, avgCheck: 45, checkLiftPct: 0, contributionMargin: 0.6, rewardCostRate: 0.017, offpeakShareOfVisits: 0.2, offpeakAvgMultiplier: 1.6, offpeakIncrementalShare: 0.4, offpeakLaborSavingsPerShiftedVisit: 0, programFixedCostPerYear: 1200, marketingCostPerYear: 1000 };
  assert.equal(simulate({ ...base, visitLiftPct: 0, offpeakIncrementalShare: 0 }).profitable, false);
  const r = simulate({ ...base, visitLiftPct: 0.12 });
  assert.equal(r.profitable, true);
  assert.ok(r.breakEvenVisitLift >= 0 && r.breakEvenVisitLift < 0.12);
});
