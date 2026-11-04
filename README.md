# Ema Rewards

A customer loyalty platform for **Ema Japanese Cuisine** (6700 Woodlands Pkwy, Suite 250, The Woodlands, TX), built for a DECA Hospitality & Tourism Operations Research project.

Guests scan a QR code at the host stand and join on their phone. Their personal QR code is scanned at checkout, and they earn **10, 11 or 12 points per $1** depending on tier, plus **1.5× or 2× points during quiet hours**. The quiet hours were chosen from Ema's own Google popular-times data. Points are redeemed for real menu items. The owner gets a dashboard with analytics, financial controls and a profitability simulator.

> For the business case (off-peak analysis, reward economics, assumptions), see [`docs/BUSINESS_ANALYSIS.md`](docs/BUSINESS_ANALYSIS.md), or open `/program` in the running app.

---

## What's inside

| Area | URL | Who |
|---|---|---|
| Landing page | `/` | everyone |
| Business case for judges | `/program` | everyone |
| Join / Sign in | `/join`, `/login` | customers |
| Customer dashboard | `/app` | customers |
| Member QR card | `/app/card` | customers |
| Rewards marketplace | `/app/rewards` | customers |
| Tiers & Quiet Hours | `/app/tiers` | customers |
| Milestone gifts | `/app/milestones` | customers |
| Ema Exclusive (Owner's Rewards, referrals) | `/app/exclusive` | customers |
| Purchase history / points ledger | `/app/history` | customers |
| Staff scanner (record purchase, verify reward) | `/staff` | employee+ |
| Owner dashboard | `/admin` | manager+ |
| Customers & VIP recognition | `/admin/customers` | manager+ |
| Off-peak analytics & schedule editor | `/admin/offpeak` | manager+ (owner edits) |
| Financial analytics | `/admin/finance` | manager+ |
| Profitability simulator | `/admin/simulator` | manager+ |
| Rewards & point pricing | `/admin/rewards` | manager+ (owner edits) |
| Promotions (double-point days, seasonal) | `/admin/promotions` | manager proposes, owner approves |
| Owner's Rewards | `/admin/owner-rewards` | owner |
| Program settings | `/admin/settings` | owner |
| Staff accounts & permissions | `/admin/staff` | owner |
| Audit log | `/admin/activity` | manager+ |
| Printable desk QR poster | `/poster` | anyone (print it) |

**Stack:** React 18 + Vite + Tailwind CSS (frontend) · Node.js 22 + Express (API) · SQLite via Node's built-in `node:sqlite` (database, no external service) · `qrcode` and `qr-scanner` (QR codes) · Recharts (charts).

We chose this stack over Next.js + Supabase so the restaurant can **deploy one service with no third-party accounts**. All points math runs on the server, every point change is a ledger row, and the whole app is one process plus one database file.

---

## Run it locally

Requires **Node.js 22.13 or newer**.

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Open http://localhost:3000. For live-reload development, use `npm run dev` (http://localhost:5173) instead.

### Demo accounts (created on first start)

| Role | Email | Password |
|---|---|---|
| Owner | `owner@emarewards.app` | `EmaOwner2026!` |
| Manager | `manager@emarewards.app` | `EmaManager2026!` |
| Employee | `staff@emarewards.app` | `EmaStaff2026!` |
| Demo customer | `demo@emarewards.app` | `demo1234` |

**Change these passwords before going live** (Owner → Staff Accounts → Reset password), or set them with environment variables before the first start (see `.env.example`).

The first start also loads **42 demonstration members** with about four months of simulated visits, shaped by the popular-times data. Everything demo is labeled. The owner dashboard has an "Include demo data" toggle, and **Owner → Program Settings → Remove all demo data** deletes it before real customers join. Set `SEED_DEMO=false` to skip it.

### Tests

```bash
npm test
```

There are 20 automated tests. They cover point calculations (all examples from the brief), tier progression, off-peak detection, milestone unlocking, QR identification and tamper rejection, redemption and point deduction, single-use reward codes, duplicate-transaction prevention, reversals with audit, role permissions, promotion approval, referrals and settings guard-rails.

---

## Deploy it so customers can scan at the desk

The camera scanner and the customer's phone need **HTTPS**. Every option below provides it. The database is one SQLite file in `DATA_DIR`, which **must be on persistent storage**, or member points are lost when the server restarts.

### Option A: Render (easiest, about $7/month)
1. Push this repository to GitHub.
2. On [render.com](https://render.com): **New → Blueprint** → select the repo. `render.yaml` sets up the web service and a 1 GB persistent disk.
3. Set `OWNER_EMAIL` and `OWNER_PASSWORD` when asked.
4. Your app is live at `https://ema-rewards.onrender.com` (or attach a custom domain such as `rewards.emajapanesecuisine.com`).

### Option B: Railway / Fly.io / any Docker host
```bash
docker build -t ema-rewards .
```
```bash
docker run -d -p 3000:3000 -v ema-data:/data -e APP_SECRET=$(openssl rand -hex 32) --name ema-rewards ema-rewards
```
On Railway or Fly.io, deploy the Dockerfile and attach a **volume mounted at `/data`**.

### Option C: Run on a computer at the restaurant
Run `npm start` on an always-on computer and expose it with HTTPS through [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared tunnel --url http://localhost:3000`).

### After deploying
1. Sign in as the owner at `https://<your-domain>/admin` and **change the default passwords**.
2. Open **Print desk QR poster** (`/poster`). It generates a QR code for your live address. Print it for the host stand and checkout counter.
3. On the checkout tablet or phone, open `https://<your-domain>/staff` and sign in as an employee. Add it to the home screen.
4. Check prices marked "price to confirm" against the in-store menu (**Owner → Rewards & Pricing → Edit**) and add real food photos with the Image URL field. Files in `public/images/` are served at `/images/...`.
5. When ready for real guests, remove the demo data.

**Backups:** copy the files in `DATA_DIR` (`ema-rewards.db*`) regularly.

---

## How the QR flow works

1. The guest opens **My Code**. The server issues a signed token `EMA1.<memberId>.<timestamp>.<HMAC signature>`. It contains no personal data, expires after 10 minutes, and the page refreshes it automatically.
2. Staff scan it in `/staff`. The server checks the signature and expiry and shows the member's name, tier, balance, any rewards ready to use, and whether an off-peak window is active.
3. Staff enter the **pre-tax subtotal** from the verified receipt, plus the check number. The server calculates base, tier, off-peak and promotion points, writes the transaction and ledger rows, and then checks milestones, streaks, referrals and tier upgrades.
4. Duplicates are blocked three ways: an idempotency key per submission, one post per check number per day, and a same-amount-within-10-minutes confirmation.
5. Reward codes (`R-XXXX-XXXX`) are single-use. Staff verify them in **Verify reward**, or redeem them straight from the guest's profile during checkout.

**POS integration path:** `POST /api/staff/purchase` already accepts `subtotal`, `tax`, `tip`, `receiptNo` and an `idempotencyKey`. A POS webhook (Chowbus/Toast/Square) can call the same logic to remove manual entry.

---

## Project structure

```
shared/            Code used by both the server and the browser
  engine.js        Points engine, reward pricing formula, simulator, default settings
  popularTimes.js  Busyness index read from the screenshots and the recommended off-peak windows
  menu.js          Menu catalog with sources and verification status
server/
  index.js         API routes, role checks, static hosting
  db.js            SQLite schema (users, transactions, ledger, rewards, redemptions, campaigns, audit log…)
  auth.js          Password hashing (scrypt), sessions, signed QR tokens
  loyalty.js       Purchases, tiers, milestones, streaks, referrals, redemptions, reversals
  analytics.js     Owner dashboard metrics, segmentation, recommendations
  seed.js          Staff accounts and labeled demo data
src/               React app (customer app, staff portal, owner dashboard)
tests/             Automated tests (node --test)
docs/              Business analysis for the DECA write-up
```
