import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_SETTINGS } from '../shared/engine.js';
import { MENU } from '../shared/menu.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'ema-rewards.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- customers, employees, managers and owners (role column = permission level)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','employee','manager','owner')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  birthday TEXT,
  password_hash TEXT NOT NULL,
  qr_secret TEXT NOT NULL,
  referral_code TEXT UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  referral_rewarded INTEGER DEFAULT 0,
  tier_key TEXT DEFAULT 'silver',
  tier_anchor_points INTEGER DEFAULT 0,
  last_birthday_year INTEGER,
  active INTEGER DEFAULT 1,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);

-- verified purchases recorded by staff
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  employee_id INTEGER REFERENCES users(id),
  receipt_no TEXT,
  receipt_key TEXT UNIQUE,            -- local date + receipt number: one check can only be posted once
  idempotency_key TEXT UNIQUE,        -- per-submission key; protects against double-tap / retries
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  tip REAL DEFAULT 0,
  eligible_amount REAL NOT NULL,
  tier_key TEXT NOT NULL,
  rate INTEGER NOT NULL,
  base_points INTEGER NOT NULL,
  offpeak_multiplier REAL DEFAULT 1,
  offpeak_window TEXT,
  offpeak_bonus INTEGER DEFAULT 0,
  promo_multiplier REAL DEFAULT 1,
  campaign_id INTEGER,
  promo_bonus INTEGER DEFAULT 0,
  total_points INTEGER NOT NULL,
  local_date TEXT NOT NULL,
  local_day INTEGER NOT NULL,
  local_hour INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  reversed_by INTEGER,
  reversed_at TEXT,
  reversal_reason TEXT,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_id);

-- every point addition or deduction has exactly one ledger row; balance = SUM(delta)
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,       -- purchase | offpeak_bonus | promo_bonus | redemption | reversal | streak | referral | adjustment | refund | expiration
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  created_by INTEGER,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON ledger(customer_id);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  price_status TEXT DEFAULT 'confirm',
  source TEXT,
  food_cost_pct REAL,
  points_override INTEGER,
  min_tier TEXT DEFAULT 'silver',
  active INTEGER DEFAULT 1,
  image_url TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  reward_id TEXT,
  reward_name TEXT NOT NULL,
  source TEXT NOT NULL,   -- marketplace | milestone | owner | birthday
  points_spent INTEGER DEFAULT 0,
  est_cost REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','used','expired','void')),
  note TEXT,
  issued_by INTEGER,
  verified_by INTEGER,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT,
  used_at TEXT,
  is_demo INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_red_customer ON redemptions(customer_id);

CREATE TABLE IF NOT EXISTS milestone_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  tier_key TEXT NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 0,
  milestone_key TEXT NOT NULL,
  redemption_id INTEGER REFERENCES redemptions(id),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (customer_id, tier_key, cycle, milestone_key)
);

CREATE TABLE IF NOT EXISTS streak_awards (
  customer_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (customer_id, month, visits)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  multiplier REAL NOT NULL,
  tiers TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  created_by INTEGER,
  approved_by INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT,
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`);

// ---------- settings ----------
export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}
export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings(key, value, updated_at) VALUES(?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(key, JSON.stringify(value));
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

export function getProgram() {
  return deepMerge(DEFAULT_SETTINGS, getSetting('program', {}));
}

// Server secret for signing QR tokens. Taken from APP_SECRET, or generated once and stored.
export function getSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  let s = getSetting('app_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('app_secret', s);
  }
  return s;
}

// Seed the rewards catalog once.
export function ensureRewards() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM rewards').get().n;
  if (n > 0) return;
  const ins = db.prepare('INSERT INTO rewards (id, name, description, category, price, price_status, source, min_tier, sort) VALUES (?,?,?,?,?,?,?,?,?)');
  MENU.forEach((m, i) => ins.run(m.id, m.name, m.description, m.category, m.price, m.priceStatus, m.source, m.minTier || 'silver', i));
}

// Re-entrant transaction helper: an outer call opens a transaction and inner calls use savepoints.
let depth = 0;
export function tx(fn) {
  const sp = `sp${depth}`;
  db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  depth++;
  try {
    const r = fn();
    depth--;
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return r;
  } catch (e) {
    depth--;
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw e;
  }
}

export function audit(actorId, action, entity, entityId, details) {
  db.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?,?,?,?,?)').run(
    actorId ?? null,
    action,
    entity ?? null,
    entityId == null ? null : String(entityId),
    details ? JSON.stringify(details) : null
  );
}

export function notify(userId, kind, title, body) {
  db.prepare('INSERT INTO notifications (user_id, kind, title, body) VALUES (?,?,?,?)').run(userId, kind, title, body || null);
}

export function rewardRow(r) {
  return r && {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    price: r.price,
    priceStatus: r.price_status,
    source: r.source,
    foodCostPct: r.food_cost_pct ?? undefined,
    pointsOverride: r.points_override ?? undefined,
    minTier: r.min_tier || 'silver',
    active: !!r.active,
    imageUrl: r.image_url || null,
    sort: r.sort,
  };
}

export function allRewards() {
  return db.prepare('SELECT * FROM rewards ORDER BY sort, name').all().map(rewardRow);
}
