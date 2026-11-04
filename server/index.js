import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, getProgram, setSetting, allRewards, ensureRewards, audit, rewardRow } from './db.js';
import {
  authMiddleware, requireRole, requireCustomer, hashPassword, verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, issueQrToken, resolveQrToken, newMemberId, newReferralCode, newQrSecret, ROLE_RANK,
} from './auth.js';
import {
  AppError, customerSummary, recordPurchase, previewPurchase, redeemReward, lookupVoucher, useVoucher, voidVoucher,
  reverseTransaction, issueOwnerReward, checkBirthday, runExpirationJob, balanceOf, qualifyingSpend, syncTier, checkMilestones,
} from './loyalty.js';
import { analytics } from './analytics.js';
import { seed, removeDemoData } from './seed.js';
import { activeOffpeakWindow, rewardPoints, rewardEconomics, sortedTiers, DEFAULT_SETTINGS } from '../shared/engine.js';
import { POPULAR_TIMES } from '../shared/popularTimes.js';

ensureRewards();
seed();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(self)');
  next();
});
app.use(authMiddleware);

// Basic CSRF protection: every state-changing API call must be JSON from the same origin.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' });
  }
  next();
});

// Tiny in-memory rate limiter for login and registration.
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}|${req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    if (e instanceof AppError) return res.status(e.status).json({ error: e.message, ...(e.extra || {}) });
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

const publicUser = (u) => u && { id: u.id, memberId: u.member_id, role: u.role, firstName: u.first_name, lastName: u.last_name, email: u.email };
const clean = (s, max = 80) => String(s ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------- public ----------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/public/config', wrap(() => {
  const s = getProgram();
  const rewards = allRewards().filter((r) => r.active).map((r) => ({ ...r, points: rewardPoints(s, r) }));
  const now = activeOffpeakWindow(s);
  const campaigns = db.prepare("SELECT id, name, description, start_at, end_at, multiplier, tiers FROM campaigns WHERE status='approved' AND end_at > ? ORDER BY start_at").all(new Date().toISOString());
  return {
    restaurant: s.restaurant,
    tiers: sortedTiers(s),
    eligibility: s.eligibility,
    offpeak: { enabled: s.offpeak.enabled, suspended: s.offpeak.suspended, windows: s.offpeak.windows.filter((w) => !w.disabled), activeNow: now, onePerCustomerPerDay: s.offpeak.onePerCustomerPerDay },
    promotions: s.promotions,
    milestones: s.milestones,
    streaks: s.streaks,
    birthday: s.birthday,
    referral: s.referral,
    expiration: s.expiration,
    terms: s.terms,
    rewards,
    campaigns,
    popularTimes: POPULAR_TIMES,
  };
}));

// ---------------- auth ----------------
app.post('/api/auth/register', rateLimit(10, 60_000), wrap((req, res) => {
  const b = req.body || {};
  const first = clean(b.firstName, 40), last = clean(b.lastName, 40), email = clean(b.email, 120).toLowerCase();
  const phone = clean(b.phone, 20).replace(/[^\d+]/g, '') || null;
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(b.birthday || '') ? b.birthday : null;
  if (!first || !last) throw new AppError(400, 'Please enter your first and last name.');
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'Please enter a valid email address.');
  if (String(b.password || '').length < 8) throw new AppError(400, 'Password must be at least 8 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new AppError(409, 'An account with this email already exists. Try signing in.');
  if (phone && db.prepare("SELECT 1 FROM users WHERE phone = ? AND role='customer'").get(phone)) throw new AppError(409, 'This phone number is already linked to an Ema Rewards account.');
  let referredBy = null;
  if (b.referralCode) {
    const ref = db.prepare("SELECT id, email, phone FROM users WHERE referral_code = ? AND role='customer'").get(clean(b.referralCode, 20).toUpperCase());
    if (!ref) throw new AppError(400, 'That referral code was not found.');
    if (ref.email === email || (phone && ref.phone === phone)) throw new AppError(400, 'You cannot refer yourself.');
    referredBy = ref.id;
  }
  const info = db
    .prepare("INSERT INTO users (member_id, role, first_name, last_name, email, phone, birthday, password_hash, qr_secret, referral_code, referred_by) VALUES (?, 'customer', ?,?,?,?,?,?,?,?,?)")
    .run(newMemberId(), first, last, email, phone, birthday, hashPassword(b.password), newQrSecret(), newReferralCode(first), referredBy);
  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO notifications (user_id, kind, title, body) VALUES (?,?,?,?)').run(
    id, 'welcome', `Welcome to Ema Rewards, ${first}!`, 'Show your member QR code at checkout to start earning 10 points per $1. Visit during off-peak hours for up to 2× points.'
  );
  audit(id, 'customer.register', 'user', id, { referred: !!referredBy });
  const { token, exp } = createSession(id);
  setSessionCookie(req, res, token, exp);
  return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
}));

app.post('/api/auth/login', rateLimit(12, 60_000), wrap((req, res) => {
  const email = clean(req.body?.email, 120).toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!u || !verifyPassword(String(req.body?.password || ''), u.password_hash)) throw new AppError(401, 'Incorrect email or password.');
  if (req.body?.portal === 'staff' && u.role === 'customer') throw new AppError(403, 'This is the staff portal. Customers sign in on the main page.');
  const { token, exp } = createSession(u.id);
  setSessionCookie(req, res, token, exp);
  audit(u.id, 'auth.login', 'user', u.id, { role: u.role });
  return { user: publicUser(u) };
}));

app.post('/api/auth/logout', wrap((req, res) => {
  destroySession(req.sessionToken);
  clearSessionCookie(res);
  return { ok: true };
}));

app.get('/api/me', wrap((req) => ({ user: publicUser(req.user) })));

// ---------------- customer ----------------
app.get('/api/customer/summary', requireCustomer, wrap((req) => {
  checkBirthday(req.user);
  return customerSummary(req.user.id);
}));

app.get('/api/customer/qr', requireCustomer, wrap((req) => issueQrToken(req.user)));

app.post('/api/customer/redeem', requireCustomer, wrap((req) => redeemReward(req.user.id, clean(req.body?.rewardId, 60))));

app.post('/api/customer/notifications/read', requireCustomer, wrap((req) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
}));

app.put('/api/customer/profile', requireCustomer, wrap((req) => {
  const b = req.body || {};
  const phone = clean(b.phone, 20).replace(/[^\d+]/g, '') || null;
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(b.birthday || '') ? b.birthday : null;
  // A birthday can be set once, so members cannot keep changing it to claim extra birthday rewards.
  const u = req.user;
  db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ?, birthday = COALESCE(birthday, ?) WHERE id = ?').run(
    clean(b.firstName, 40) || u.first_name, clean(b.lastName, 40) || u.last_name, phone, birthday, u.id
  );
  return { ok: true };
}));

app.post('/api/customer/refresh-qr', requireCustomer, wrap((req) => {
  db.prepare('UPDATE users SET qr_secret = ? WHERE id = ?').run(newQrSecret(), req.user.id);
  audit(req.user.id, 'customer.qr_rotate', 'user', req.user.id);
  return issueQrToken(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
}));

// ---------------- staff (employee+) ----------------
function staffCustomerView(u) {
  const s = getProgram();
  const summary = customerSummary(u.id);
  return {
    id: u.id,
    memberId: u.member_id,
    name: `${u.first_name} ${u.last_name.charAt(0)}.`,
    tier: summary.tier,
    balance: summary.points.balance,
    visits: summary.visits,
    vouchers: summary.vouchers.filter((v) => v.status === 'issued').map((v) => ({ code: v.code, reward_name: v.reward_name, expires_at: v.expires_at, source: v.source })),
    offpeakNow: activeOffpeakWindow(s),
  };
}

app.post('/api/staff/identify', requireRole('employee'), wrap((req) => {
  const b = req.body || {};
  let user;
  if (b.token) {
    const r = resolveQrToken(b.token);
    if (r.error) throw new AppError(400, r.error);
    user = r.user;
  } else if (b.memberId) {
    // Manual fallback when the camera can't read the code. Every manual lookup is audited.
    user = db.prepare("SELECT * FROM users WHERE member_id = ? AND role='customer' AND active=1").get(clean(b.memberId, 20).toUpperCase());
    if (!user) throw new AppError(404, 'No member with that ID.');
    audit(req.user.id, 'staff.manual_lookup', 'user', user.id);
  } else throw new AppError(400, 'Scan a member QR code or enter a member ID.');
  return { customer: staffCustomerView(user) };
}));

app.post('/api/staff/preview', requireRole('employee'), wrap((req) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role='customer'").get(Number(req.body?.customerId));
  if (!u) throw new AppError(404, 'Customer not found.');
  syncTier(u.id, { silent: true });
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  const p = previewPurchase(fresh, req.body);
  return { calc: p.calc, window: p.window, campaign: p.campaign && { name: p.campaign.name, multiplier: p.campaign.multiplier } };
}));

app.post('/api/staff/purchase', requireRole('employee'), wrap((req) => {
  const b = req.body || {};
  const r = recordPurchase({
    customerId: Number(b.customerId), employeeId: req.user.id, subtotal: b.subtotal, tax: b.tax, tip: b.tip,
    receiptNo: clean(b.receiptNo, 30), idempotencyKey: clean(b.idempotencyKey, 80), confirmDuplicate: !!b.confirmDuplicate,
  });
  return r;
}));

app.post('/api/staff/voucher/lookup', requireRole('employee'), wrap((req) => {
  const v = lookupVoucher(req.body?.code);
  return { voucher: { code: v.code, reward_name: v.reward_name, status: v.status, source: v.source, expires_at: v.expires_at, used_at: v.used_at, member: `${v.first_name} ${v.last_name.charAt(0)}.`, memberId: v.member_id } };
}));

app.post('/api/staff/voucher/use', requireRole('employee'), wrap((req) => {
  const v = useVoucher(req.body?.code, req.user.id, req.body?.customerId ? Number(req.body.customerId) : null);
  return { voucher: { code: v.code, reward_name: v.reward_name, status: v.status } };
}));

app.get('/api/staff/recent', requireRole('employee'), wrap((req) => {
  const rows = db
    .prepare(`SELECT t.id, t.created_at, t.subtotal, t.total_points, t.offpeak_bonus, t.receipt_no, t.status, u.first_name, u.last_name, u.member_id
      FROM transactions t JOIN users u ON u.id = t.customer_id WHERE t.employee_id = ? ORDER BY t.created_at DESC LIMIT 15`)
    .all(req.user.id);
  return { rows };
}));

// ---------------- manager+ ----------------
app.get('/api/admin/analytics', requireRole('manager'), wrap((req) => analytics({ includeDemo: req.query.demo !== '0' })));

app.get('/api/admin/customers', requireRole('manager'), wrap((req) => {
  const q = `%${clean(req.query.q, 60)}%`;
  const rows = db
    .prepare(`SELECT id, member_id, first_name, last_name, email, phone, tier_key, created_at, is_demo FROM users
      WHERE role='customer' AND (first_name || ' ' || last_name LIKE ? OR email LIKE ? OR member_id LIKE ? OR IFNULL(phone,'') LIKE ?)
      ORDER BY created_at DESC LIMIT 100`)
    .all(q, q, q, q);
  return { rows: rows.map((r) => ({ ...r, balance: balanceOf(r.id), spend: qualifyingSpend(r.id) })) };
}));

app.get('/api/admin/customers/:id', requireRole('manager'), wrap((req) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role='customer'").get(Number(req.params.id));
  if (!u) throw new AppError(404, 'Not found');
  const s = customerSummary(u.id);
  const audits = db.prepare("SELECT a.*, x.first_name AS actor FROM audit_log a LEFT JOIN users x ON x.id = a.actor_id WHERE (entity='user' AND entity_id=?) OR details LIKE ? ORDER BY a.created_at DESC LIMIT 40").all(String(u.id), `%${u.member_id}%`);
  return { ...s, audits, active: !!u.active };
}));

app.post('/api/admin/customers/:id/adjust', requireRole('manager'), wrap((req) => {
  const id = Number(req.params.id);
  const delta = Math.trunc(Number(req.body?.points));
  const reason = clean(req.body?.reason, 200);
  if (!delta || Math.abs(delta) > 20000) throw new AppError(400, 'Enter a point adjustment between −20,000 and 20,000.');
  if (reason.length < 3) throw new AppError(400, 'A reason is required.');
  db.prepare("INSERT INTO ledger (customer_id, delta, kind, note, created_by) VALUES (?,?,'adjustment',?,?)").run(id, delta, reason, req.user.id);
  db.prepare('INSERT INTO notifications (user_id, kind, title, body) VALUES (?,?,?,?)').run(id, 'adjustment', `${delta > 0 ? '+' : ''}${delta} points adjustment`, reason);
  audit(req.user.id, 'points.adjust', 'user', id, { delta, reason });
  checkMilestones(id);
  return { balance: balanceOf(id) };
}));

app.post('/api/admin/customers/:id/active', requireRole('owner'), wrap((req) => {
  db.prepare("UPDATE users SET active = ? WHERE id = ? AND role='customer'").run(req.body?.active ? 1 : 0, Number(req.params.id));
  audit(req.user.id, req.body?.active ? 'customer.reactivate' : 'customer.deactivate', 'user', req.params.id);
}));

app.post('/api/admin/transactions/:id/reverse', requireRole('manager'), wrap((req) => reverseTransaction(Number(req.params.id), req.user.id, clean(req.body?.reason, 200))));

app.post('/api/admin/redemptions/:id/void', requireRole('manager'), wrap((req) => voidVoucher(Number(req.params.id), req.user.id, clean(req.body?.reason, 200))));

app.get('/api/admin/redemptions', requireRole('manager'), wrap(() => ({
  rows: db.prepare(`SELECT r.*, u.first_name, u.last_name, u.member_id, v.first_name AS verifier FROM redemptions r JOIN users u ON u.id = r.customer_id
    LEFT JOIN users v ON v.id = r.verified_by ORDER BY r.issued_at DESC LIMIT 200`).all(),
})));

app.get('/api/admin/transactions', requireRole('manager'), wrap(() => ({
  rows: db.prepare(`SELECT t.*, u.first_name, u.last_name, u.member_id, e.first_name AS employee FROM transactions t JOIN users u ON u.id = t.customer_id
    LEFT JOIN users e ON e.id = t.employee_id ORDER BY t.created_at DESC LIMIT 200`).all(),
})));

app.get('/api/admin/audit', requireRole('manager'), wrap(() => ({
  rows: db.prepare('SELECT a.*, u.first_name, u.last_name, u.role FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC, a.id DESC LIMIT 300').all(),
})));

// Off-peak emergency switch (manager+)
app.post('/api/admin/offpeak/suspend', requireRole('manager'), wrap((req) => {
  const s = getProgram();
  s.offpeak.suspended = !!req.body?.suspended;
  setSetting('program', s);
  audit(req.user.id, s.offpeak.suspended ? 'offpeak.suspend' : 'offpeak.resume', 'settings', 'offpeak');
  return { suspended: s.offpeak.suspended };
}));

// Campaigns: managers may propose and suspend campaigns; only owners approve them (financial approval).
app.get('/api/admin/campaigns', requireRole('manager'), wrap(() => ({ rows: db.prepare('SELECT c.*, u.first_name AS creator FROM campaigns c LEFT JOIN users u ON u.id = c.created_by ORDER BY c.start_at DESC').all() })));

app.post('/api/admin/campaigns', requireRole('manager'), wrap((req) => {
  const b = req.body || {};
  const s = getProgram();
  const mult = Number(b.multiplier);
  if (!clean(b.name)) throw new AppError(400, 'Name is required.');
  if (!(mult > 1 && mult <= s.promotions.maxMultiplier)) throw new AppError(400, `Multiplier must be above 1 and at most ${s.promotions.maxMultiplier}×.`);
  const start = new Date(b.start_at), end = new Date(b.end_at);
  if (isNaN(start) || isNaN(end) || end <= start) throw new AppError(400, 'Choose a valid start and end time.');
  if ((end - start) / 864e5 > 31) throw new AppError(400, 'Campaigns can last at most 31 days.');
  const status = req.user.role === 'owner' && b.approve ? 'approved' : 'pending';
  const info = db.prepare('INSERT INTO campaigns (name, description, start_at, end_at, multiplier, tiers, status, created_by, approved_by) VALUES (?,?,?,?,?,?,?,?,?)').run(
    clean(b.name), clean(b.description, 300), start.toISOString(), end.toISOString(), mult, JSON.stringify(Array.isArray(b.tiers) ? b.tiers : []), status, req.user.id, status === 'approved' ? req.user.id : null
  );
  audit(req.user.id, 'campaign.create', 'campaign', info.lastInsertRowid, { name: b.name, mult, status });
  if (status === 'approved') announceCampaign(Number(info.lastInsertRowid));
  return { id: Number(info.lastInsertRowid), status };
}));

function announceCampaign(id) {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  const tiers = JSON.parse(c.tiers || '[]');
  const users = db.prepare("SELECT id, tier_key FROM users WHERE role='customer' AND active=1 AND is_demo=0").all().filter((u) => !tiers.length || tiers.includes(u.tier_key));
  const ins = db.prepare("INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'promo', ?, ?)");
  for (const u of users) ins.run(u.id, `${c.name}: ${c.multiplier}× points`, `${c.description || ''} ${new Date(c.start_at).toLocaleDateString('en-US')} – ${new Date(c.end_at).toLocaleDateString('en-US')}`.trim());
}

app.post('/api/admin/campaigns/:id/status', requireRole('manager'), wrap((req) => {
  const status = req.body?.status;
  if (!['approved', 'suspended', 'pending'].includes(status)) throw new AppError(400, 'Invalid status');
  if (status === 'approved' && req.user.role !== 'owner') throw new AppError(403, 'Only the owner can give financial approval to a promotion.');
  const prev = db.prepare('SELECT status FROM campaigns WHERE id = ?').get(Number(req.params.id));
  db.prepare('UPDATE campaigns SET status = ?, approved_by = CASE WHEN ? = \'approved\' THEN ? ELSE approved_by END WHERE id = ?').run(status, status, req.user.id, Number(req.params.id));
  audit(req.user.id, `campaign.${status}`, 'campaign', req.params.id);
  if (status === 'approved' && prev?.status === 'pending') announceCampaign(Number(req.params.id));
}));

// ---------------- owner ----------------
app.get('/api/admin/settings', requireRole('manager'), wrap(() => ({ settings: getProgram(), defaults: DEFAULT_SETTINGS })));

app.put('/api/admin/settings', requireRole('owner'), wrap((req) => {
  const next = req.body?.settings;
  if (!next || typeof next !== 'object') throw new AppError(400, 'Invalid settings');
  // validation guard-rails
  const tiers = [...(next.tiers || [])].sort((a, b) => a.minSpend - b.minSpend);
  if (tiers.length !== 3) throw new AppError(400, 'There must be exactly three tiers.');
  if (tiers[0].minSpend !== 0) throw new AppError(400, 'The starting tier must have a $0 threshold.');
  for (const t of tiers) if (!(t.rate > 0 && t.rate <= 50)) throw new AppError(400, 'Points per dollar must be between 1 and 50.');
  for (const w of next.offpeak?.windows || []) {
    if (!(w.multiplier >= 1 && w.multiplier <= (next.promotions?.maxMultiplier || 2))) throw new AppError(400, `Off-peak multipliers must be between 1× and the ${next.promotions?.maxMultiplier || 2}× promotion cap.`);
    if (!/^\d{2}:\d{2}$/.test(w.start) || !/^\d{2}:\d{2}$/.test(w.end) || w.end <= w.start) throw new AppError(400, 'Each off-peak window needs a valid start and end time.');
  }
  const f = next.finance || {};
  if (!(f.maxRewardCostRate > 0 && f.maxRewardCostRate < 0.2)) throw new AppError(400, 'Maximum reward cost rate must be between 0% and 20%.');
  next.tiers = tiers;
  const prev = getProgram();
  setSetting('program', next);
  audit(req.user.id, 'settings.update', 'settings', 'program', diffKeys(prev, next));
  return { settings: getProgram() };
}));

function diffKeys(a, b) {
  const changed = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
  return { changed };
}

app.get('/api/admin/rewards', requireRole('manager'), wrap(() => {
  const s = getProgram();
  return { rows: allRewards().map((r) => ({ ...r, economics: rewardEconomics(s, r) })) };
}));

app.put('/api/admin/rewards/:id', requireRole('owner'), wrap((req) => {
  const b = req.body || {};
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(req.params.id);
  if (!r) throw new AppError(404, 'Not found');
  const price = Number(b.price);
  if (!(price > 0 && price < 500)) throw new AppError(400, 'Invalid price');
  const fc = b.foodCostPct === '' || b.foodCostPct == null ? null : Number(b.foodCostPct);
  if (fc != null && !(fc > 0 && fc < 1)) throw new AppError(400, 'Food cost must be between 0 and 100%.');
  const po = b.pointsOverride === '' || b.pointsOverride == null ? null : Math.round(Number(b.pointsOverride));
  if (po != null && !(po >= 50)) throw new AppError(400, 'Point price must be at least 50.');
  db.prepare('UPDATE rewards SET name=?, description=?, category=?, price=?, price_status=?, food_cost_pct=?, points_override=?, min_tier=?, active=?, image_url=? WHERE id=?').run(
    clean(b.name, 80) || r.name, clean(b.description, 300), b.category || r.category, price, b.priceStatus === 'verified' ? 'verified' : 'confirm', fc, po, b.minTier || 'silver', b.active ? 1 : 0, clean(b.imageUrl, 500) || null, r.id
  );
  audit(req.user.id, 'reward.update', 'reward', r.id, { price, pointsOverride: po, active: !!b.active });
  return { row: rewardRow(db.prepare('SELECT * FROM rewards WHERE id = ?').get(r.id)) };
}));

app.post('/api/admin/rewards', requireRole('owner'), wrap((req) => {
  const b = req.body || {};
  const id = clean(b.name, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(2).toString('hex');
  const price = Number(b.price);
  if (!clean(b.name) || !(price > 0)) throw new AppError(400, 'Name and price are required.');
  db.prepare('INSERT INTO rewards (id, name, description, category, price, price_status, source, min_tier, active, sort) VALUES (?,?,?,?,?,?,?,?,1,999)').run(
    id, clean(b.name), clean(b.description, 300), b.category || 'specialty', price, 'confirm', 'added by owner', b.minTier || 'silver'
  );
  audit(req.user.id, 'reward.create', 'reward', id, { name: b.name, price });
  return { id };
}));

app.post('/api/admin/owner-rewards', requireRole('owner'), wrap((req) => issueOwnerReward(req.user.id, {
  customerId: Number(req.body?.customerId), rewardId: req.body?.rewardId || null, title: clean(req.body?.title, 80), note: clean(req.body?.note, 200), validDays: req.body?.validDays,
})));

app.get('/api/admin/owner-rewards', requireRole('manager'), wrap(() => ({
  rows: db.prepare(`SELECT r.*, u.first_name, u.last_name, u.member_id, i.first_name AS issuer FROM redemptions r JOIN users u ON u.id = r.customer_id
    LEFT JOIN users i ON i.id = r.issued_by WHERE r.source = 'owner' ORDER BY r.issued_at DESC LIMIT 100`).all(),
})));

// staff accounts
app.get('/api/admin/staff', requireRole('owner'), wrap(() => ({
  rows: db.prepare("SELECT id, first_name, last_name, email, role, active, created_at FROM users WHERE role <> 'customer' ORDER BY role DESC, first_name").all(),
})));

app.post('/api/admin/staff', requireRole('owner'), wrap((req) => {
  const b = req.body || {};
  const email = clean(b.email, 120).toLowerCase();
  if (!['employee', 'manager', 'owner'].includes(b.role)) throw new AppError(400, 'Choose a role.');
  if (!EMAIL_RE.test(email) || !clean(b.firstName)) throw new AppError(400, 'Name and a valid email are required.');
  if (String(b.password || '').length < 8) throw new AppError(400, 'Temporary password must be at least 8 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new AppError(409, 'Email already in use.');
  const info = db.prepare('INSERT INTO users (member_id, role, first_name, last_name, email, password_hash, qr_secret) VALUES (?,?,?,?,?,?,?)').run(
    newMemberId(), b.role, clean(b.firstName, 40), clean(b.lastName, 40) || '-', email, hashPassword(b.password), newQrSecret()
  );
  audit(req.user.id, 'staff.create', 'user', info.lastInsertRowid, { role: b.role, email });
  return { id: Number(info.lastInsertRowid) };
}));

app.put('/api/admin/staff/:id', requireRole('owner'), wrap((req) => {
  const id = Number(req.params.id);
  const target = db.prepare("SELECT * FROM users WHERE id = ? AND role <> 'customer'").get(id);
  if (!target) throw new AppError(404, 'Not found');
  if (id === req.user.id && (req.body.active === false || (req.body.role && req.body.role !== 'owner'))) throw new AppError(400, 'You cannot deactivate or demote your own owner account.');
  if (req.body.password) {
    if (String(req.body.password).length < 8) throw new AppError(400, 'Password must be at least 8 characters.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.password), id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  if (req.body.role && ROLE_RANK[req.body.role] >= 1) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, id);
  if (typeof req.body.active === 'boolean') {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, id);
    if (!req.body.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  audit(req.user.id, 'staff.update', 'user', id, { role: req.body.role, active: req.body.active, passwordReset: !!req.body.password });
}));

app.post('/api/account/password', wrap((req) => {
  if (!req.user) throw new AppError(401, 'Please sign in.');
  if (!verifyPassword(String(req.body?.current || ''), req.user.password_hash)) throw new AppError(400, 'Current password is incorrect.');
  if (String(req.body?.next || '').length < 8) throw new AppError(400, 'New password must be at least 8 characters.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(req.body.next), req.user.id);
  audit(req.user.id, 'auth.password_change', 'user', req.user.id);
}));

app.post('/api/admin/demo-data', requireRole('owner'), wrap((req) => {
  if (req.body?.action === 'remove') {
    removeDemoData();
    audit(req.user.id, 'demo.remove', 'system', null);
    return { ok: true, removed: true };
  }
  if (req.body?.action === 'load') {
    seed({ force: true });
    audit(req.user.id, 'demo.load', 'system', null);
    return { ok: true, loaded: true };
  }
  throw new AppError(400, 'Unknown action');
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------------- static frontend ----------------
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) => res.send('API running. Run "npm run build" to build the frontend, or "npm run dev" for development.'));
}

runExpirationJob();
setInterval(runExpirationJob, 60 * 60 * 1000).unref();

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Ema Rewards running on http://localhost:${PORT}`));
