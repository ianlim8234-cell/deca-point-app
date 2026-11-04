import { db, getProgram, allRewards, notify, audit, tx } from './db.js';
import { newRedemptionCode } from './auth.js';
import {
  calculatePoints,
  activeOffpeakWindow,
  activeCampaign,
  tierFor,
  nextTier,
  tierRank,
  milestoneStatus,
  rewardPoints,
  rewardCost,
  localParts,
  fmtTime,
} from '../shared/engine.js';

export class AppError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const EARN_KINDS = "('purchase','offpeak_bonus','promo_bonus','streak','referral','adjustment','reversal')";

export const balanceOf = (cid) => db.prepare('SELECT COALESCE(SUM(delta),0) AS b FROM ledger WHERE customer_id = ?').get(cid).b;
export const lifetimeEarned = (cid) =>
  db.prepare(`SELECT COALESCE(SUM(delta),0) AS b FROM ledger WHERE customer_id = ? AND kind IN ${EARN_KINDS}`).get(cid).b;
export const qualifyingSpend = (cid) =>
  db.prepare("SELECT COALESCE(SUM(eligible_amount),0) AS s FROM transactions WHERE customer_id = ? AND status = 'posted'").get(cid).s;

function addLedger(cid, delta, kind, refType, refId, note, by, isDemo = 0, at = null) {
  if (!delta) return;
  if (at) {
    db.prepare('INSERT INTO ledger (customer_id, delta, kind, ref_type, ref_id, note, created_by, is_demo, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(cid, delta, kind, refType, refId, note, by ?? null, isDemo, at);
  } else {
    db.prepare('INSERT INTO ledger (customer_id, delta, kind, ref_type, ref_id, note, created_by, is_demo) VALUES (?,?,?,?,?,?,?,?)').run(cid, delta, kind, refType, refId, note, by ?? null, isDemo);
  }
}

const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const rewardById = (id) => allRewards().find((r) => r.id === id);

function isoPlusDays(days, from = new Date()) {
  return new Date(from.getTime() + days * 864e5).toISOString();
}

function issueVoucher(cid, { rewardId, rewardName, source, note, issuedBy, validDays, isDemo = 0, at = null, estCost }) {
  const settings = getProgram();
  const r = rewardId ? rewardById(rewardId) : null;
  const code = newRedemptionCode();
  const issuedAt = at ? new Date(at) : new Date();
  const expires = isoPlusDays(validDays ?? settings.expiration.rewardValidDays, issuedAt);
  const cost = estCost ?? (r ? rewardCost(settings, r) : 0);
  const info = db
    .prepare('INSERT INTO redemptions (code, customer_id, reward_id, reward_name, source, points_spent, est_cost, note, issued_by, issued_at, expires_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(code, cid, rewardId || null, rewardName || r?.name || 'Reward', source, 0, cost, note || null, issuedBy ?? null, issuedAt.toISOString(), expires, isDemo);
  return { id: Number(info.lastInsertRowid), code, expires };
}

// ---------- tier ----------
export function syncTier(cid, { silent = false } = {}) {
  const settings = getProgram();
  const u = getUser(cid);
  const spend = qualifyingSpend(cid);
  const target = tierFor(settings, spend);
  if (target.key === u.tier_key) return { changed: false, tier: target };
  const up = tierRank(settings, target.key) > tierRank(settings, u.tier_key);
  // Milestone progress restarts when a member enters a new tier.
  db.prepare('UPDATE users SET tier_key = ?, tier_anchor_points = ? WHERE id = ?').run(target.key, lifetimeEarned(cid), cid);
  if (!silent) {
    if (up) notify(cid, 'tier', `Welcome to ${target.name}! 🎉`, `You now earn ${target.rate} points per $1 and have unlocked ${target.name} rewards.`);
    else notify(cid, 'tier', `Membership updated to ${target.name}`, 'A purchase was corrected, which changed your qualifying spend.');
  }
  return { changed: true, up, tier: target };
}

// ---------- milestones ----------
export function checkMilestones(cid, { isDemo = 0, at = null, silent = false } = {}) {
  const settings = getProgram();
  const u = getUser(cid);
  const inTier = lifetimeEarned(cid) - (u.tier_anchor_points || 0);
  const st = milestoneStatus(settings, u.tier_key, inTier);
  const unlocked = [];
  const cycles = st.repeats ? st.cycle : 0;
  for (let c = 0; c <= cycles; c++) {
    for (const m of st.list) {
      const reached = c < cycles || m.points <= st.progressPoints;
      if (!reached) continue;
      const exists = db.prepare('SELECT 1 FROM milestone_unlocks WHERE customer_id=? AND tier_key=? AND cycle=? AND milestone_key=?').get(cid, u.tier_key, c, m.key);
      if (exists) continue;
      const r = rewardById(m.rewardId);
      const v = issueVoucher(cid, { rewardId: m.rewardId, rewardName: `${m.label}${r ? ` – ${r.name}` : ''}`, source: 'milestone', note: `${u.tier_key} milestone at ${m.points.toLocaleString()} pts`, isDemo, at });
      db.prepare('INSERT INTO milestone_unlocks (customer_id, tier_key, cycle, milestone_key, redemption_id) VALUES (?,?,?,?,?)').run(cid, u.tier_key, c, m.key, v.id);
      if (!silent) notify(cid, 'milestone', `Milestone unlocked: ${m.label} 🎁`, `${r ? r.name : 'Your reward'} is ready in My Rewards. Show code ${v.code} at checkout.`);
      unlocked.push({ ...m, code: v.code, rewardName: r?.name });
    }
  }
  return unlocked;
}

// ---------- streaks ----------
function checkStreaks(cid, month, { isDemo = 0, at = null, silent = false } = {}) {
  const settings = getProgram();
  if (!settings.streaks.enabled) return [];
  const visits = db
    .prepare("SELECT COUNT(DISTINCT local_date) AS n FROM transactions WHERE customer_id = ? AND status = 'posted' AND substr(local_date,1,7) = ?")
    .get(cid, month).n;
  const awarded = [];
  for (const lvl of settings.streaks.levels) {
    if (visits < lvl.visits) continue;
    const r = db.prepare('INSERT OR IGNORE INTO streak_awards (customer_id, month, visits) VALUES (?,?,?)').run(cid, month, lvl.visits);
    if (r.changes) {
      addLedger(cid, lvl.points, 'streak', 'streak', null, `${lvl.visits} visits in ${month}`, null, isDemo, at);
      if (!silent) notify(cid, 'streak', `Visit streak: ${lvl.visits} visits this month 🔥`, `You earned ${lvl.points} bonus points.`);
      awarded.push(lvl);
    }
  }
  return awarded;
}

// ---------- referral ----------
function checkReferral(cid, eligible, { isDemo = 0, at = null, silent = false } = {}) {
  const settings = getProgram();
  const u = getUser(cid);
  if (!settings.referral.enabled || !u.referred_by || u.referral_rewarded) return null;
  if (eligible < settings.referral.minPurchase) return null;
  db.prepare('UPDATE users SET referral_rewarded = 1 WHERE id = ?').run(cid);
  addLedger(u.referred_by, settings.referral.referrerPoints, 'referral', 'user', cid, `Referral: ${u.first_name} made a first visit`, null, isDemo, at);
  addLedger(cid, settings.referral.refereePoints, 'referral', 'user', u.referred_by, 'Welcome bonus for joining by referral', null, isDemo, at);
  if (!silent) {
    notify(u.referred_by, 'referral', 'Your referral paid off! 🙌', `${u.first_name} made a first visit. You earned ${settings.referral.referrerPoints} points.`);
    notify(cid, 'referral', 'Referral bonus', `You earned ${settings.referral.refereePoints} bonus points for joining with a friend’s code.`);
  }
  return true;
}

// ---------- purchases ----------
export function previewPurchase(customer, { subtotal, tax, tip }, when = new Date()) {
  const settings = getProgram();
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'approved'").all();
  const window = activeOffpeakWindow(settings, when);
  const campaign = activeCampaign(campaigns, customer.tier_key, when);
  const lp = localParts(when, settings.restaurant.timezone);
  const usedToday = !!db
    .prepare("SELECT 1 FROM transactions WHERE customer_id = ? AND local_date = ? AND status='posted' AND offpeak_bonus > 0")
    .get(customer.id, lp.date);
  const calc = calculatePoints(settings, { subtotal, tax, tip, tierKey: customer.tier_key, offpeakWindow: window, campaign, offpeakAlreadyUsedToday: usedToday });
  return { calc, window, campaign, lp };
}

export function recordPurchase({ customerId, employeeId, subtotal, tax = 0, tip = 0, receiptNo, idempotencyKey, confirmDuplicate = false, at = null, isDemo = 0, silent = false }) {
  subtotal = Number(subtotal);
  tax = Number(tax) || 0;
  tip = Number(tip) || 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) throw new AppError(400, 'Enter the purchase subtotal.');
  if (subtotal > 5000 || tax < 0 || tip < 0 || tax > 1000 || tip > 2000) throw new AppError(400, 'Amount out of range. Please check the receipt.');
  if (!idempotencyKey) throw new AppError(400, 'Missing submission key.');

  return tx(() => {
    const prior = db.prepare('SELECT * FROM transactions WHERE idempotency_key = ?').get(idempotencyKey);
    if (prior) return { duplicate: true, transaction: prior };

    const customer = getUser(customerId);
    if (!customer || customer.role !== 'customer' || !customer.active) throw new AppError(404, 'Customer account not found.');
    syncTier(customer.id, { silent: true });
    const fresh = getUser(customerId);
    const when = at ? new Date(at) : new Date();
    const { calc, window, campaign, lp } = previewPurchase(fresh, { subtotal, tax, tip }, when);

    const receipt = receiptNo ? String(receiptNo).trim().toUpperCase() : '';
    const receiptKey = receipt ? `${lp.date}#${receipt}` : null;
    if (receiptKey && db.prepare('SELECT 1 FROM transactions WHERE receipt_key = ?').get(receiptKey)) {
      throw new AppError(409, `Check #${receipt} has already been posted today. Each receipt can earn points only once.`);
    }
    if (!receiptKey && !confirmDuplicate && !at) {
      const recent = db
        .prepare("SELECT id FROM transactions WHERE customer_id = ? AND abs(subtotal - ?) < 0.005 AND status='posted' AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes')")
        .get(customer.id, subtotal);
      if (recent) throw new AppError(409, 'A purchase with this same amount was posted for this guest in the last 10 minutes. Is this a separate check?', { possibleDuplicate: true });
    }
    if (!calc.qualifies) throw new AppError(400, calc.notes[0]);

    const createdAt = when.toISOString();
    const info = db
      .prepare(
        `INSERT INTO transactions (customer_id, employee_id, receipt_no, receipt_key, idempotency_key, subtotal, tax, tip, eligible_amount, tier_key, rate, base_points,
          offpeak_multiplier, offpeak_window, offpeak_bonus, promo_multiplier, campaign_id, promo_bonus, total_points, local_date, local_day, local_hour, is_demo, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        customer.id, employeeId ?? null, receipt || null, receiptKey, idempotencyKey, subtotal, tax, tip, calc.eligible, fresh.tier_key, calc.rate, calc.basePoints,
        calc.offpeakBonus > 0 ? calc.offpeakMultiplier : 1, window ? `${fmtTime(window.start)}–${fmtTime(window.end)}` : null, calc.offpeakBonus,
        calc.promoBonus > 0 ? calc.promoMultiplier : 1, campaign?.id ?? null, calc.promoBonus, calc.totalPoints, lp.date, lp.day, lp.hour, isDemo, createdAt
      );
    const txId = Number(info.lastInsertRowid);
    const ledAt = at ? createdAt : null;
    addLedger(customer.id, calc.basePoints, 'purchase', 'transaction', txId, `$${calc.eligible.toFixed(2)} × ${calc.rate} pts`, employeeId, isDemo, ledAt);
    addLedger(customer.id, calc.offpeakBonus, 'offpeak_bonus', 'transaction', txId, `Off-peak ${calc.offpeakMultiplier}×`, employeeId, isDemo, ledAt);
    addLedger(customer.id, calc.promoBonus, 'promo_bonus', 'transaction', txId, campaign ? `${campaign.name} ${campaign.multiplier}×` : 'Promotion', employeeId, isDemo, ledAt);

    if (!silent) {
      notify(customer.id, 'purchase', `+${calc.totalPoints.toLocaleString()} points earned`, `$${calc.eligible.toFixed(2)} × ${calc.rate} = ${calc.basePoints} base${calc.bonusPoints ? ` + ${calc.bonusPoints} bonus (${calc.multiplier}×)` : ''}.`);
    }
    const streaks = checkStreaks(customer.id, lp.month, { isDemo, at: ledAt, silent });
    const referral = checkReferral(customer.id, calc.eligible, { isDemo, at: ledAt, silent });
    // Milestones are checked in the tier the member was in when they earned the points. Only then can they move up a tier.
    const milestones = checkMilestones(customer.id, { isDemo, at: ledAt, silent });
    const tier = syncTier(customer.id, { silent });
    if (!isDemo) audit(employeeId, 'purchase.record', 'transaction', txId, { customer: customer.member_id, subtotal, points: calc.totalPoints, receipt: receipt || null });

    return {
      duplicate: false,
      transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId),
      calc,
      window,
      campaign,
      streaks,
      referral: !!referral,
      milestones,
      tierChange: tier.changed ? tier : null,
      balance: balanceOf(customer.id),
    };
  });
}

export function reverseTransaction(txId, actorId, reason) {
  if (!reason || reason.trim().length < 3) throw new AppError(400, 'A reason is required for every reversal.');
  return tx(() => {
    const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
    if (!t) throw new AppError(404, 'Transaction not found.');
    if (t.status !== 'posted') throw new AppError(409, 'This transaction was already reversed.');
    db.prepare("UPDATE transactions SET status='reversed', reversed_by=?, reversed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), reversal_reason=? WHERE id=?").run(actorId, reason, txId);
    addLedger(t.customer_id, -t.total_points, 'reversal', 'transaction', txId, `Reversal: ${reason}`, actorId, t.is_demo);
    notify(t.customer_id, 'adjustment', 'A purchase was corrected', `${t.total_points} points from a ${t.local_date} purchase were reversed. Reason: ${reason}`);
    syncTier(t.customer_id);
    audit(actorId, 'purchase.reverse', 'transaction', txId, { reason, points: t.total_points });
    return { ok: true, balance: balanceOf(t.customer_id) };
  });
}

// ---------- redemptions ----------
export function expireVouchers() {
  db.prepare("UPDATE redemptions SET status='expired' WHERE status='issued' AND expires_at IS NOT NULL AND expires_at < ?").run(new Date().toISOString());
}

export function monthRedemptionCost() {
  const month = new Date().toISOString().slice(0, 7);
  return db.prepare("SELECT COALESCE(SUM(est_cost),0) AS c FROM redemptions WHERE status IN ('issued','used') AND substr(issued_at,1,7) = ? AND is_demo = 0").get(month).c;
}

export function redeemReward(customerId, rewardId) {
  const settings = getProgram();
  return tx(() => {
    const u = getUser(customerId);
    const r = rewardById(rewardId);
    if (!r || !r.active) throw new AppError(404, 'This reward is not available right now.');
    if (tierRank(settings, u.tier_key) < tierRank(settings, r.minTier)) throw new AppError(403, `This reward is for ${r.minTier} members and above.`);
    const points = rewardPoints(settings, r);
    const bal = balanceOf(customerId);
    if (bal < points) throw new AppError(400, `You need ${(points - bal).toLocaleString()} more points.`);
    const cost = rewardCost(settings, r);
    if (monthRedemptionCost() + cost > settings.finance.monthlyRedemptionBudget) {
      audit(null, 'redeem.budget_block', 'reward', rewardId, { customer: u.member_id });
      throw new AppError(503, 'Marketplace redemptions are paused for the rest of this month. Your points are safe; please check back soon.');
    }
    const code = newRedemptionCode();
    const expires = isoPlusDays(settings.expiration.rewardValidDays);
    const info = db
      .prepare("INSERT INTO redemptions (code, customer_id, reward_id, reward_name, source, points_spent, est_cost, expires_at) VALUES (?,?,?,?, 'marketplace', ?,?,?)")
      .run(code, customerId, r.id, r.name, points, cost, expires);
    const rid = Number(info.lastInsertRowid);
    addLedger(customerId, -points, 'redemption', 'redemption', rid, r.name, customerId);
    notify(customerId, 'redemption', `Reward ready: ${r.name}`, `Show code ${code} to your server. Valid until ${new Date(expires).toLocaleDateString('en-US')}.`);
    audit(customerId, 'reward.redeem', 'redemption', rid, { reward: r.id, points });
    return { code, expires, points, balance: balanceOf(customerId), reward: r };
  });
}

export function lookupVoucher(code) {
  expireVouchers();
  const c = String(code || '').trim().toUpperCase();
  const v = db
    .prepare('SELECT r.*, u.first_name, u.last_name, u.member_id FROM redemptions r JOIN users u ON u.id = r.customer_id WHERE r.code = ?')
    .get(c);
  if (!v) throw new AppError(404, 'No reward found with that code.');
  return v;
}

export function useVoucher(code, staffId, customerId = null) {
  return tx(() => {
    const v = lookupVoucher(code);
    if (customerId && v.customer_id !== customerId) throw new AppError(409, 'This reward belongs to a different member.');
    if (v.status !== 'issued') throw new AppError(409, `This reward is ${v.status === 'used' ? 'already used' : v.status} and cannot be redeemed.`);
    const r = db.prepare("UPDATE redemptions SET status='used', used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), verified_by=? WHERE id=? AND status='issued'").run(staffId, v.id);
    if (!r.changes) throw new AppError(409, 'This reward was just redeemed.');
    audit(staffId, 'reward.use', 'redemption', v.id, { code: v.code });
    notify(v.customer_id, 'redemption', `Enjoy your ${v.reward_name}!`, 'Your reward was redeemed. Thank you for dining with Ema.');
    return { ...v, status: 'used' };
  });
}

export function voidVoucher(id, actorId, reason) {
  return tx(() => {
    const v = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(id);
    if (!v) throw new AppError(404, 'Not found.');
    if (v.status !== 'issued' && v.status !== 'expired') throw new AppError(409, 'Only unused rewards can be voided.');
    db.prepare("UPDATE redemptions SET status='void' WHERE id=?").run(id);
    if (v.points_spent > 0) addLedger(v.customer_id, v.points_spent, 'refund', 'redemption', id, `Refund: ${reason || 'voided'}`, actorId, v.is_demo);
    audit(actorId, 'reward.void', 'redemption', id, { reason, refunded: v.points_spent });
    return { ok: true };
  });
}

export function issueOwnerReward(actorId, { customerId, rewardId, title, note, validDays }) {
  const u = getUser(customerId);
  if (!u || u.role !== 'customer') throw new AppError(404, 'Customer not found.');
  const r = rewardId ? rewardById(rewardId) : null;
  if (!r && !title) throw new AppError(400, 'Choose a menu item or enter a reward title.');
  const v = issueVoucher(customerId, { rewardId: r?.id, rewardName: title || r.name, source: 'owner', note, issuedBy: actorId, validDays: Number(validDays) || 60 });
  notify(customerId, 'owner', 'A personal thank-you from Ema 🎌', `${title || r.name}${note ? ` — “${note}”` : ''}. Show code ${v.code} at your next visit.`);
  audit(actorId, 'owner_reward.issue', 'redemption', v.id, { customer: u.member_id, reward: title || r.name });
  return v;
}

// ---------- birthday ----------
export function checkBirthday(u) {
  const settings = getProgram();
  if (!settings.birthday.enabled || !u.birthday || u.role !== 'customer') return;
  const lp = localParts(new Date(), settings.restaurant.timezone);
  const [y, m] = lp.month.split('-');
  if (u.birthday.slice(5, 7) !== m || Number(u.last_birthday_year) === Number(y)) return;
  db.prepare('UPDATE users SET last_birthday_year = ? WHERE id = ?').run(Number(y), u.id);
  const r = rewardById(settings.birthday.rewardId);
  const v = issueVoucher(u.id, { rewardId: r?.id, rewardName: `Birthday Treat – ${r?.name || 'Chef’s choice'}`, source: 'birthday', note: 'Happy birthday from Ema!' });
  notify(u.id, 'birthday', 'Happy birthday! 🎂', `Your birthday treat is in My Rewards (code ${v.code}). Valid for 30 days.`);
}

// ---------- points expiration ----------
export function runExpirationJob() {
  const settings = getProgram();
  expireVouchers();
  const months = Number(settings.expiration.pointsExpireAfterInactiveMonths);
  if (!months) return;
  const cutoff = new Date(Date.now() - months * 30 * 864e5).toISOString();
  const warnCutoff = new Date(Date.now() - (months * 30 - 30) * 864e5).toISOString();
  const rows = db
    .prepare(
      `SELECT u.id, (SELECT MAX(created_at) FROM ledger l WHERE l.customer_id = u.id AND l.kind <> 'expiration') AS last_at,
        (SELECT COALESCE(SUM(delta),0) FROM ledger l WHERE l.customer_id = u.id) AS bal
       FROM users u WHERE u.role = 'customer' AND u.is_demo = 0`
    )
    .all();
  for (const r of rows) {
    if (!r.last_at || r.bal <= 0) continue;
    if (r.last_at < cutoff) {
      addLedger(r.id, -r.bal, 'expiration', null, null, `No activity for ${months} months`, null);
      notify(r.id, 'expiration', 'Your points expired', `${r.bal} points expired after ${months} months without activity.`);
    } else if (r.last_at < warnCutoff) {
      const warned = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'expiring' AND created_at > ?").get(r.id, r.last_at);
      if (!warned) notify(r.id, 'expiring', 'Your points expire soon ⏳', `Visit Ema within 30 days to keep your ${r.bal.toLocaleString()} points.`);
    }
  }
  // Warn about vouchers expiring within 5 days.
  const soon = db
    .prepare("SELECT * FROM redemptions WHERE status='issued' AND expires_at < ? AND is_demo = 0")
    .all(new Date(Date.now() + 5 * 864e5).toISOString());
  for (const v of soon) {
    const warned = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind='voucher_expiring' AND body LIKE ?").get(v.customer_id, `%${v.code}%`);
    if (!warned) notify(v.customer_id, 'voucher_expiring', `${v.reward_name} expires soon`, `Code ${v.code} expires ${new Date(v.expires_at).toLocaleDateString('en-US')}.`);
  }
}

// ---------- customer summary ----------
export function customerSummary(userId) {
  const settings = getProgram();
  expireVouchers();
  const u = getUser(userId);
  const spend = qualifyingSpend(userId);
  const earned = lifetimeEarned(userId);
  const balance = balanceOf(userId);
  const tier = settings.tiers.find((t) => t.key === u.tier_key) || settings.tiers[0];
  const nt = nextTier(settings, tier.key);
  const month = localParts(new Date(), settings.restaurant.timezone).month;
  const monthRow = db
    .prepare(`SELECT COALESCE(SUM(CASE WHEN delta > 0 AND kind IN ${EARN_KINDS} THEN delta ELSE 0 END),0) AS e FROM ledger WHERE customer_id = ? AND substr(created_at,1,7) = ?`)
    .get(userId, month);
  const spent = -db.prepare("SELECT COALESCE(SUM(delta),0) AS s FROM ledger WHERE customer_id = ? AND kind = 'redemption'").get(userId).s;
  const refunded = db.prepare("SELECT COALESCE(SUM(delta),0) AS s FROM ledger WHERE customer_id = ? AND kind = 'refund'").get(userId).s;
  const visits = db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE customer_id = ? AND status='posted'").get(userId).n;
  const monthVisits = db.prepare("SELECT COUNT(DISTINCT local_date) AS n FROM transactions WHERE customer_id = ? AND status='posted' AND substr(local_date,1,7)=?").get(userId, month).n;
  const ms = milestoneStatus(settings, tier.key, earned - (u.tier_anchor_points || 0));
  const rewards = allRewards().filter((r) => r.active);
  const cheapest = rewards
    .filter((r) => tierRank(settings, u.tier_key) >= tierRank(settings, r.minTier))
    .map((r) => ({ id: r.id, name: r.name, points: rewardPoints(settings, r) }))
    .filter((r) => r.points > balance)
    .sort((a, b) => a.points - b.points)[0];
  const vouchers = db
    .prepare("SELECT * FROM redemptions WHERE customer_id = ? ORDER BY CASE status WHEN 'issued' THEN 0 ELSE 1 END, issued_at DESC LIMIT 60")
    .all(userId);
  const transactions = db.prepare('SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);
  const ledger = db.prepare('SELECT * FROM ledger WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').all(userId);
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30').all(userId);
  const referrals = db.prepare('SELECT first_name, referral_rewarded, created_at FROM users WHERE referred_by = ?').all(userId);
  const campaigns = db.prepare("SELECT id, name, description, start_at, end_at, multiplier, tiers FROM campaigns WHERE status='approved' AND end_at > ? ORDER BY start_at").all(new Date().toISOString());
  return {
    profile: {
      id: u.id,
      memberId: u.member_id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      birthday: u.birthday,
      memberSince: u.created_at,
      referralCode: u.referral_code,
      isDemo: !!u.is_demo,
    },
    points: { balance, lifetime: earned, thisMonth: monthRow.e, spent: spent - refunded },
    spend,
    visits,
    monthVisits,
    tier,
    nextTier: nt ? { ...nt, remaining: Math.max(0, nt.minSpend - spend), progress: Math.min(1, (spend - tier.minSpend) / (nt.minSpend - tier.minSpend)) } : null,
    milestones: ms,
    nextReward: cheapest ? { ...cheapest, needed: cheapest.points - balance } : null,
    vouchers,
    transactions,
    ledger,
    notifications,
    unread: notifications.filter((n) => !n.read).length,
    referrals,
    campaigns,
  };
}
