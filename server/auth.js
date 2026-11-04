import crypto from 'node:crypto';
import { db, getSecret } from './db.js';

const SESSION_DAYS = 30;
const QR_TTL_MS = 10 * 60 * 1000; // a customer's QR token is valid for 10 minutes

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), userId, exp);
  return { token, exp };
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

export function userFromToken(token) {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1')
    .get(sha(token), new Date().toISOString());
  return row || null;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const COOKIE = 'ema_session';

export function setSessionCookie(req, res, token, exp) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(exp).toUTCString()}${secure ? '; Secure' : ''}`
  );
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function authMiddleware(req, _res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  req.sessionToken = token;
  req.user = userFromToken(token);
  next();
}

export const ROLE_RANK = { customer: 0, employee: 1, manager: 2, owner: 3 };

export function requireRole(min) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
    if (ROLE_RANK[req.user.role] < ROLE_RANK[min]) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}

export function requireCustomer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer account required.' });
  next();
}

// ---------- QR tokens ----------
// Format: EMA1.<memberId>.<issuedAtBase36>.<signature>
// The token carries no personal data. The signature uses the server secret plus a secret
// unique to each customer. Rotating that customer secret revokes all of their old codes.
function sign(memberId, ts, userSecret) {
  return crypto.createHmac('sha256', getSecret()).update(`${memberId}.${ts}.${userSecret}`).digest('base64url').slice(0, 22);
}

export function issueQrToken(user) {
  const ts = Date.now().toString(36);
  return { token: `EMA1.${user.member_id}.${ts}.${sign(user.member_id, ts, user.qr_secret)}`, expiresAt: Date.now() + QR_TTL_MS, ttlMs: QR_TTL_MS };
}

export function resolveQrToken(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'EMA1') return { error: 'This is not an Ema Rewards code.' };
  const [, memberId, ts, sig] = parts;
  const user = db.prepare("SELECT * FROM users WHERE member_id = ? AND role = 'customer' AND active = 1").get(memberId);
  if (!user) return { error: 'Member not found.' };
  const expected = sign(memberId, ts, user.qr_secret);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return { error: 'Invalid or tampered code.' };
  const age = Date.now() - parseInt(ts, 36);
  if (age > QR_TTL_MS || age < -60000) return { error: 'This code has expired. Ask the guest to refresh their Ema Rewards card.' };
  return { user };
}

// ---------- IDs ----------
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I to avoid misreads
export function randomCode(len) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}
export function newMemberId() {
  for (;;) {
    const id = `EMA-${randomCode(4)}-${randomCode(4)}`;
    if (!db.prepare('SELECT 1 FROM users WHERE member_id = ?').get(id)) return id;
  }
}
export function newReferralCode(first) {
  for (;;) {
    const c = `${String(first || 'EMA').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5) || 'EMA'}${randomCode(4)}`;
    if (!db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(c)) return c;
  }
}
export function newRedemptionCode() {
  for (;;) {
    const c = `R-${randomCode(4)}-${randomCode(4)}`;
    if (!db.prepare('SELECT 1 FROM redemptions WHERE code = ?').get(c)) return c;
  }
}
export const newQrSecret = () => crypto.randomBytes(16).toString('hex');
