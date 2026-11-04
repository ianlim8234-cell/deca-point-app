// End-to-end API tests against a real server running on a throwaway database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ema-test-'));
let proc;

class Client {
  constructor() { this.cookie = ''; }
  async req(method, p, body) {
    const res = await fetch(BASE + '/api' + p, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
  put(p, b = {}) { return this.req('PUT', p, b); }
}

before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DIR, SEED_DEMO: 'false' }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => { proc?.kill(); fs.rmSync(DIR, { recursive: true, force: true }); });

const staff = new Client(), owner = new Client(), manager = new Client(), cust = new Client(), cust2 = new Client();
let customer, token;

test('register, login, roles', async () => {
  let r = await cust.post('/auth/register', { firstName: 'Kai', lastName: 'Test', email: 'kai@example.com', password: 'password1', birthday: '2000-01-01' });
  assert.equal(r.status, 200);
  customer = r.data.user;
  assert.match(customer.memberId, /^EMA-/);
  r = await cust.post('/auth/register', { firstName: 'Kai', lastName: 'Dup', email: 'kai@example.com', password: 'password1' });
  assert.equal(r.status, 409, 'duplicate email rejected');
  assert.equal((await staff.post('/auth/login', { email: 'staff@emarewards.app', password: 'EmaStaff2026!' })).status, 200);
  assert.equal((await owner.post('/auth/login', { email: 'owner@emarewards.app', password: 'EmaOwner2026!' })).status, 200);
  assert.equal((await manager.post('/auth/login', { email: 'manager@emarewards.app', password: 'EmaManager2026!' })).status, 200);
});

test('permissions: customers cannot record purchases; employees cannot see admin', async () => {
  assert.equal((await cust.post('/staff/purchase', { customerId: customer.id, subtotal: 100, idempotencyKey: 'x' })).status, 403);
  assert.equal((await staff.get('/admin/analytics')).status, 403);
  assert.equal((await manager.put('/admin/settings', { settings: {} })).status, 403);
  assert.equal((await new Client().get('/customer/summary')).status, 401);
});

test('QR token identifies the customer; tampering is rejected', async () => {
  const r = await cust.get('/customer/qr');
  token = r.data.token;
  assert.ok(!token.includes('kai@example.com'), 'no PII in token');
  const id = await staff.post('/staff/identify', { token });
  assert.equal(id.status, 200);
  assert.equal(id.data.customer.id, customer.id);
  const bad = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await staff.post('/staff/identify', { token: bad })).status, 400);
});

test('purchase posts correct points, ledger and tier progression', async () => {
  let r = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 40, tax: 3.3, tip: 8, receiptNo: 'T1', idempotencyKey: 'k1' });
  assert.equal(r.status, 200);
  assert.equal(r.data.calc.basePoints, 400);
  // Retrying the same submission is harmless
  const again = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 40, receiptNo: 'T1', idempotencyKey: 'k1' });
  assert.equal(again.data.duplicate, true);
  // Same receipt with a new key is blocked
  assert.equal((await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 40, receiptNo: 'T1', idempotencyKey: 'k2' })).status, 409);
  // Same amount without a receipt number within 10 minutes needs confirmation
  const s1 = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 25, idempotencyKey: 'k3' });
  assert.equal(s1.status, 200);
  const s2 = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 25, idempotencyKey: 'k4' });
  assert.equal(s2.status, 409);
  assert.equal(s2.data.possibleDuplicate, true);
  // Push into Gold
  r = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 150, receiptNo: 'T2', idempotencyKey: 'k5' });
  assert.equal(r.status, 200);
  const sum = await cust.get('/customer/summary');
  assert.equal(sum.data.tier.key, 'gold');
  const ledgerTotal = sum.data.ledger.reduce((s, l) => s + l.delta, 0);
  assert.equal(ledgerTotal, sum.data.points.balance, 'balance equals the ledger sum');
  // Silver milestones reached while in Silver (600 and 1500 pts) were unlocked
  const ms = sum.data.vouchers.filter((v) => v.source === 'milestone');
  assert.equal(ms.length, 2);
  // Next purchase earns at the Gold rate
  r = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 10, receiptNo: 'T3', idempotencyKey: 'k6' });
  assert.equal(r.data.calc.rate, 11);
});

test('redemption deducts points, issues a single-use code, cannot be reused', async () => {
  const before = (await cust.get('/customer/summary')).data.points.balance;
  const r = await cust.post('/customer/redeem', { rewardId: 'edamame' });
  assert.equal(r.status, 200);
  assert.equal(r.data.balance, before - 900);
  const code = r.data.code;
  assert.equal((await staff.post('/staff/voucher/use', { code })).status, 200);
  assert.equal((await staff.post('/staff/voucher/use', { code })).status, 409);
  // Tier-gated and unaffordable rewards are refused
  assert.equal((await cust.post('/customer/redeem', { rewardId: 'unlimited-classic' })).status, 403);
  assert.equal((await cust.post('/customer/redeem', { rewardId: 'sashimi-combo' })).status, 400);
  // Redemption does not lower the tier
  assert.equal((await cust.get('/customer/summary')).data.tier.key, 'gold');
});

test('reversal requires a reason, is audited and is one-time', async () => {
  const sum = await cust.get('/customer/summary');
  const tx = sum.data.transactions.find((t) => t.receipt_no === 'T3');
  assert.equal((await manager.post(`/admin/transactions/${tx.id}/reverse`, { reason: '' })).status, 400);
  assert.equal((await staff.post(`/admin/transactions/${tx.id}/reverse`, { reason: 'wrong guest' })).status, 403);
  assert.equal((await manager.post(`/admin/transactions/${tx.id}/reverse`, { reason: 'wrong guest' })).status, 200);
  assert.equal((await manager.post(`/admin/transactions/${tx.id}/reverse`, { reason: 'again' })).status, 409);
  const audit = await manager.get('/admin/audit');
  assert.ok(audit.data.rows.some((a) => a.action === 'purchase.reverse'));
});

test('promotions need owner approval; owner can issue exclusive rewards', async () => {
  const start = new Date(Date.now() - 60000).toISOString(), end = new Date(Date.now() + 3600e3).toISOString();
  const c = await manager.post('/admin/campaigns', { name: 'Test 2x', start_at: start, end_at: end, multiplier: 2 });
  assert.equal(c.data.status, 'pending');
  assert.equal((await manager.post(`/admin/campaigns/${c.data.id}/status`, { status: 'approved' })).status, 403);
  assert.equal((await manager.post('/admin/campaigns', { name: 'Too big', start_at: start, end_at: end, multiplier: 3 })).status, 400);
  assert.equal((await owner.post(`/admin/campaigns/${c.data.id}/status`, { status: 'approved' })).status, 200);
  const p = await staff.post('/staff/purchase', { customerId: customer.id, subtotal: 20, receiptNo: 'T4', idempotencyKey: 'k7' });
  assert.equal(p.data.calc.multiplier, 2);
  const g = await owner.post('/admin/owner-rewards', { customerId: customer.id, title: 'Private omakase invitation', note: 'Thank you!' });
  assert.equal(g.status, 200);
  const sum = await cust.get('/customer/summary');
  assert.ok(sum.data.vouchers.some((v) => v.source === 'owner' && v.code === g.data.code));
});

test('referrals: credit only after a qualifying first purchase; no self-referral', async () => {
  const sum = await cust.get('/customer/summary');
  const code = sum.data.profile.referralCode;
  assert.equal((await new Client().post('/auth/register', { firstName: 'Kai', lastName: 'X', email: 'kai@example.com', password: 'password1', referralCode: code })).status, 409);
  const r = await cust2.post('/auth/register', { firstName: 'Mio', lastName: 'Friend', email: 'mio@example.com', password: 'password1', referralCode: code });
  assert.equal(r.status, 200);
  const before = (await cust.get('/customer/summary')).data.points.balance;
  await staff.post('/staff/purchase', { customerId: r.data.user.id, subtotal: 30, receiptNo: 'T5', idempotencyKey: 'k8' });
  const after = (await cust.get('/customer/summary')).data.points.balance;
  assert.equal(after - before, 500);
});

test('settings validation guards financial limits', async () => {
  const s = (await owner.get('/admin/settings')).data.settings;
  const bad = structuredClone(s);
  bad.offpeak.windows[0].multiplier = 5;
  assert.equal((await owner.put('/admin/settings', { settings: bad })).status, 400);
  const ok = structuredClone(s);
  ok.tiers[1].minSpend = 250;
  assert.equal((await owner.put('/admin/settings', { settings: ok })).status, 200);
  const a = await owner.get('/admin/analytics');
  assert.equal(a.status, 200);
  assert.ok(a.data.finance.totalSales > 0);
});
