// Creates the first staff accounts and (optionally) clearly-labeled demonstration data.
// Every demo row is stored with is_demo = 1 so the owner dashboard can exclude it, and the
// owner can delete it with one click before launch.
import { db, tx } from './db.js';
import { hashPassword, newMemberId, newQrSecret, newReferralCode, newRedemptionCode } from './auth.js';
import { recordPurchase, balanceOf } from './loyalty.js';
import { POPULAR_TIMES } from '../shared/popularTimes.js';

function rng(seedVal) {
  let a = seedVal >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAFF = [
  { role: 'owner', first: 'Restaurant', last: 'Owner', email: process.env.OWNER_EMAIL || 'owner@emarewards.app', password: process.env.OWNER_PASSWORD || 'EmaOwner2026!' },
  { role: 'manager', first: 'Floor', last: 'Manager', email: process.env.MANAGER_EMAIL || 'manager@emarewards.app', password: process.env.MANAGER_PASSWORD || 'EmaManager2026!' },
  { role: 'employee', first: 'Front', last: 'Desk', email: process.env.EMPLOYEE_EMAIL || 'staff@emarewards.app', password: process.env.EMPLOYEE_PASSWORD || 'EmaStaff2026!' },
];

const FIRST = ['Aiden', 'Sofia', 'Marcus', 'Priya', 'Ethan', 'Hana', 'Diego', 'Olivia', 'Kenji', 'Grace', 'Noah', 'Isabella', 'Liam', 'Mei', 'Caleb', 'Ava', 'Jordan', 'Chloe', 'Mateo', 'Emily', 'Ryan', 'Zoe', 'Tyler', 'Yuna', 'Brandon', 'Leah', 'Andre', 'Nora', 'Kevin', 'Maya', 'Jason', 'Elena', 'Daniel', 'Aria', 'Chris', 'Sara', 'Lucas', 'Natalie', 'Owen', 'Julia', 'Sam', 'Riley'];
const LAST = ['Nguyen', 'Garcia', 'Smith', 'Patel', 'Johnson', 'Tanaka', 'Lopez', 'Kim', 'Brown', 'Chen', 'Williams', 'Martinez', 'Davis', 'Sato', 'Miller', 'Wilson', 'Anderson', 'Lee', 'Thomas', 'Moore'];

export function seed({ force = false } = {}) {
  // staff accounts (only when none exist)
  const staffCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role <> 'customer'").get().n;
  if (!staffCount) {
    for (const s of STAFF) {
      db.prepare('INSERT INTO users (member_id, role, first_name, last_name, email, password_hash, qr_secret) VALUES (?,?,?,?,?,?,?)').run(
        newMemberId(), s.role, s.first, s.last, s.email, hashPassword(s.password), newQrSecret()
      );
    }
    console.log('Created default staff accounts (change these passwords in Owner → Staff):');
    for (const s of STAFF) console.log(`  ${s.role.padEnd(8)} ${s.email}`);
  }

  const wantDemo = force || (process.env.SEED_DEMO ?? 'true') !== 'false';
  const hasDemo = db.prepare('SELECT 1 FROM users WHERE is_demo = 1 LIMIT 1').get();
  const demoFlag = db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get();
  if (!wantDemo || hasDemo || (demoFlag && !force)) return;

  const rand = rng(20261104);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const staffId = db.prepare("SELECT id FROM users WHERE role = 'employee' LIMIT 1").get()?.id;
  const DAY = 864e5;
  const now = Date.now();

  // Weighted (day, hour) sampler that follows the Google popular-times profile.
  const slots = [];
  for (const [d, hours] of Object.entries(POPULAR_TIMES)) for (const [h, v] of Object.entries(hours)) slots.push({ d: +d, h: +h, w: v });
  const totalW = slots.reduce((s, x) => s + x.w, 0);
  const sampleSlot = () => {
    let r = rand() * totalW;
    for (const s of slots) if ((r -= s.w) <= 0) return s;
    return slots.at(-1);
  };
  // Converts an "N days ago at local day/hour" to a UTC Date for America/Chicago (approximated as UTC−6, or UTC−5 during DST).
  const localToDate = (daysAgo, slot) => {
    const base = new Date(now - daysAgo * DAY);
    // move to the closest preceding date with the desired weekday
    const dow = base.getUTCDay();
    const back = (dow - slot.d + 7) % 7;
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - back));
    const month = d.getUTCMonth();
    const offset = month >= 2 && month <= 9 ? 5 : 6; // rough DST rule
    return new Date(d.getTime() + (slot.h + offset) * 3600e3 + Math.floor(rand() * 55) * 60e3);
  };

  tx(() => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_seeded', 'true')").run();

    // A past (approved) seasonal campaign and an upcoming one awaiting owner approval
    const c1s = new Date(now - 40 * DAY), c1e = new Date(now - 33 * DAY);
    db.prepare("INSERT INTO campaigns (name, description, start_at, end_at, multiplier, tiers, status) VALUES (?,?,?,?,?,?, 'approved')").run(
      'Momiji Autumn Week (demo)', 'Celebrate autumn leaves with 1.5× points on every visit.', c1s.toISOString(), c1e.toISOString(), 1.5, '[]'
    );
    const c2s = new Date(now + 20 * DAY), c2e = new Date(now + 27 * DAY);
    db.prepare("INSERT INTO campaigns (name, description, start_at, end_at, multiplier, tiers, status) VALUES (?,?,?,?,?,?, 'pending')").run(
      'Winter Ramen Nights (demo)', 'Proposed: 2× points Monday–Wednesday dinner for Gold and Platinum.', c2s.toISOString(), c2e.toISOString(), 2, '["gold","platinum"]'
    );

    const people = [];
    const N = 42;
    for (let i = 0; i < N; i++) {
      const first = i === 0 ? 'Demo' : FIRST[i % FIRST.length];
      const last = i === 0 ? 'Guest' : pick(LAST);
      const email = i === 0 ? 'demo@emarewards.app' : `${first}.${last}.${i}@example.com`.toLowerCase();
      // engagement profile: a few loyal regulars, many occasional guests, some lapsed
      const profile = i === 0 ? 'regular' : rand() < 0.2 ? 'regular' : rand() < 0.6 ? 'occasional' : rand() < 0.5 ? 'lapsed' : 'new';
      const joinedDaysAgo = profile === 'new' ? 5 + Math.floor(rand() * 25) : 60 + Math.floor(rand() * 120);
      const created = new Date(now - joinedDaysAgo * DAY).toISOString();
      const bday = i === 0 ? `1998-${String(new Date().getMonth() + 1).padStart(2, '0')}-15` : rand() < 0.6 ? `19${70 + Math.floor(rand() * 30)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}` : null;
      const info = db
        .prepare("INSERT INTO users (member_id, role, first_name, last_name, email, phone, birthday, password_hash, qr_secret, referral_code, is_demo, created_at, last_birthday_year) VALUES (?, 'customer', ?,?,?,?,?,?,?,?,1,?,?)")
        .run(newMemberId(), first, last, email, null, bday, hashPassword(i === 0 ? 'demo1234' : `demo-${i}-${Math.floor(rand() * 1e9)}`), newQrSecret(), newReferralCode(first), created, i === 0 ? null : new Date().getFullYear());
      people.push({ id: Number(info.lastInsertRowid), profile, joinedDaysAgo });
    }
    // two referral relationships
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(people[0].id, people[5].id);
    db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(people[1].id, people[6].id);

    // Build each guest's visits and process them in chronological order, so tiers, milestones and streaks come out right.
    const events = [];
    for (const p of people) {
      const visits = p.profile === 'regular' ? 10 + Math.floor(rand() * 12) : p.profile === 'occasional' ? 2 + Math.floor(rand() * 5) : p.profile === 'lapsed' ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
      for (let v = 0; v < visits; v++) {
        let daysAgo;
        if (p.profile === 'lapsed') daysAgo = 50 + rand() * (p.joinedDaysAgo - 50);
        else daysAgo = 1 + rand() * (p.joinedDaysAgo - 1);
        const at = localToDate(daysAgo, sampleSlot());
        if (at.getTime() > now - 3600e3 || at.getTime() < now - p.joinedDaysAgo * DAY) continue;
        const party = rand() < 0.45 ? 1 : rand() < 0.75 ? 2 : 3 + Math.floor(rand() * 3);
        const subtotal = Math.round((16 + rand() * 22) * party * 100) / 100;
        events.push({ cid: p.id, at, subtotal });
      }
    }
    events.sort((a, b) => a.at - b.at);
    for (const e of events) {
      try {
        recordPurchase({ customerId: e.cid, employeeId: staffId, subtotal: e.subtotal, tax: Math.round(e.subtotal * 0.0825 * 100) / 100, tip: Math.round(e.subtotal * 0.18 * 100) / 100, idempotencyKey: `demo-${e.cid}-${e.at.getTime()}`, at: e.at.toISOString(), isDemo: 1, silent: true, confirmDuplicate: true });
      } catch (err) {
        if (!/already/.test(err.message)) throw err;
      }
    }

    // Some marketplace redemptions and milestone usage
    const rewards = db.prepare("SELECT * FROM rewards WHERE active = 1 AND min_tier = 'silver'").all();
    for (const p of people) {
      const bal = balanceOf(p.id);
      if (bal > 1200 && rand() < 0.6) {
        const r = pick(rewards.filter((x) => x.price <= 8));
        const pts = 900;
        const at = new Date(now - Math.floor(rand() * 40) * DAY).toISOString();
        const code = newRedemptionCode();
        const used = rand() < 0.7;
        const info = db
          .prepare("INSERT INTO redemptions (code, customer_id, reward_id, reward_name, source, points_spent, est_cost, status, issued_at, expires_at, used_at, verified_by, is_demo) VALUES (?,?,?,?, 'marketplace', ?,?,?,?,?,?,?,1)")
          .run(code, p.id, r.id, r.name, pts, Math.round((r.price * 0.3 + 0.25) * 100) / 100, used ? 'used' : 'issued', at, new Date(new Date(at).getTime() + 30 * DAY).toISOString(), used ? at : null, used ? staffId : null);
        db.prepare("INSERT INTO ledger (customer_id, delta, kind, ref_type, ref_id, note, is_demo, created_at) VALUES (?,?,'redemption','redemption',?,?,1,?)").run(p.id, -pts, info.lastInsertRowid, r.name, at);
      }
    }
    // Mark most older milestone vouchers as used
    db.prepare("UPDATE redemptions SET status='used', used_at=issued_at, verified_by=? WHERE is_demo=1 AND source='milestone' AND issued_at < ? AND (id % 3) <> 0").run(staffId, new Date(now - 7 * DAY).toISOString());

    // Owner reward for the demo guest + a welcome notification
    const demoId = people[0].id;
    db.prepare("INSERT INTO redemptions (code, customer_id, reward_id, reward_name, source, est_cost, note, issued_at, expires_at, is_demo) VALUES (?,?,?,?, 'owner', ?,?,?,?,1)").run(
      newRedemptionCode(), demoId, 'sake-abalone', 'Chef’s Thank-You: Sake-Simmered Abalone', 2.65, 'Thank you for being one of our most loyal guests! – The Ema Family', new Date(now - 2 * DAY).toISOString(), new Date(now + 58 * DAY).toISOString()
    );
    db.prepare("INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'welcome', ?, ?)").run(demoId, 'This is a demonstration account', 'Purchases, points and rewards in this account are sample data for presentations.');
    db.prepare("INSERT INTO notifications (user_id, kind, title, body) VALUES (?, 'owner', ?, ?)").run(demoId, 'A personal thank-you from Ema 🎌', 'Chef’s Thank-You: Sake-Simmered Abalone is waiting in Ema Exclusive.');
  });
  console.log('Loaded demonstration data (42 sample members). Sign in as demo@emarewards.app / demo1234');
}

export function removeDemoData() {
  tx(() => {
    const ids = db.prepare('SELECT id FROM users WHERE is_demo = 1').all().map((r) => r.id);
    const inList = ids.length ? `(${ids.join(',')})` : '(NULL)';
    db.exec(`UPDATE users SET referred_by = NULL WHERE referred_by IN ${inList};`);
    db.exec(`DELETE FROM ledger WHERE customer_id IN ${inList} OR is_demo = 1;`);
    db.exec(`DELETE FROM milestone_unlocks WHERE customer_id IN ${inList};`);
    db.exec(`DELETE FROM redemptions WHERE customer_id IN ${inList} OR is_demo = 1;`);
    db.exec(`DELETE FROM transactions WHERE customer_id IN ${inList} OR is_demo = 1;`);
    db.exec(`DELETE FROM streak_awards WHERE customer_id IN ${inList};`);
    db.exec(`DELETE FROM notifications WHERE user_id IN ${inList};`);
    db.exec(`DELETE FROM sessions WHERE user_id IN ${inList};`);
    db.exec("DELETE FROM campaigns WHERE name LIKE '%(demo)';");
    db.exec(`DELETE FROM users WHERE id IN ${inList};`);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_seeded', 'true')").run();
  });
}
