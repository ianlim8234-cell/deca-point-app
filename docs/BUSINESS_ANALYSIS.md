# Ema Rewards: business analysis

DECA Hospitality & Tourism Operations Research (HTOR) project: a loyalty program for **Ema Japanese Cuisine**, 6700 Woodlands Pkwy, Suite 250, The Woodlands, TX 77382 · (281) 651-2542.

This document records the research, the off-peak analysis, the financial model and every assumption behind the app. Most numbers can be edited live in **Owner → Program Settings**.

---

## 1. Research and sources

| Source | Used for | Notes |
|---|---|---|
| `popular_hours.pdf` (7 Google "Popular times" screenshots, Mon–Sun, supplied by the team) | Off-peak schedule, demo traffic pattern | Relative busyness, not absolute counts |
| emajapanesecuisine.com/food-menu (official menu) | Dine-in item names and prices | Prices marked **verified** |
| Ema's Chowbus online-ordering store (`pos.chowbus.com/.../21424`) | Roll and to-go prices, Ema Roll description | To-go prices may be higher than dine-in |
| DoorDash / Uber Eats / Yelp listings | Specialty roll and entrée names; reference prices | Marked **price to confirm**, because delivery prices often include a markup |
| Yelp Q&A | Unlimited sushi tiers ($39.95 Classic / $59.95 Premium) | To confirm |

**Limits of the research:** our build environment could not open the Chowbus store or the official menu directly; menu data was gathered through web search results of those pages. **Before launch, check every item marked "price to confirm" against the in-store menu** (Owner → Rewards & Pricing → Edit → "Verified against menu"). No food costs, sales figures or customer counts were available, so all financial inputs below are clearly labeled assumptions.

**Branding:** we could not access Ema's own photography. The app uses an original ink-and-vermilion Japanese design system (Shippori Mincho headings, seigaiha wave pattern, washi-paper neutrals) with drawn placeholders for food. The owner can add real photos to each reward with the Image URL field.

---

## 2. Off-peak analysis (from `popular_hours.pdf`)

### Method
1. On each screenshot we measured every bar's height from the baseline in pixels.
2. We divided by the height of the dashed reference line to get a 0–100 index. Google scales all days against the same reference, so days can be compared with each other. **Friday 6 PM ≈ 94** is the busiest hour of the week.
3. Bars appear 11 AM–10 PM Sun–Thu and 11 AM–11 PM Fri–Sat, which suggests those are the operating hours.
4. We classified each hour: **≤ 30 very slow** (2× candidate) · **≤ 40 slow** (1.5× candidate) · **41–59 moderate** (no bonus) · **≥ 60 peak** (never rewarded).

Reading accuracy is about ±3 index points.

### Busyness index (0–100)

| | 11a | 12p | 1p | 2p | 3p | 4p | 5p | 6p | 7p | 8p | 9p | 10p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mon | 45 | 59 | 59 | 57 | 49 | 45 | 41 | 43 | **36** | **33** | **22** | – |
| Tue | **24** | **36** | **36** | 41 | 40 | 50 | 53 | 68 | 59 | 50 | **31** | – |
| Wed | **27** | **31** | 40 | 41 | **38** | **33** | **37** | 43 | 43 | **33** | **24** | – |
| Thu | **33** | 43 | 40 | 40 | **36** | **39** | 45 | 56 | 54 | 45 | **37** | – |
| Fri | **38** | 42 | 40 | **37** | **38** | 50 | 74 | 94 | 90 | 76 | 57 | 43 |
| Sat | 40 | 50 | 61 | 62 | 63 | 62 | 73 | 73 | 73 | 63 | 45 | **33** |
| Sun | **35** | 52 | 68 | 68 | 56 | 52 | 55 | 67 | 70 | 57 | **39** | – |

### Findings
- **Peak demand (never rewarded):** Friday 5–10 PM (74–94), Saturday 1–9 PM (61–73), Sunday 1–3 PM and 6–8 PM (67–70), Tuesday 6 PM (68).
- **Slowest hours:** Monday 9 PM (22, the lowest of the week), Tuesday 11 AM (24), Wednesday 9 PM (24), Wednesday 11 AM (27).
- **Wednesday is the slowest day overall.** It never goes above 43, which makes it the best candidate for a recurring mid-week promotion.
- Weekday **openings (11 AM)** and **last seatings (9 PM)** are consistently quiet.

### Recommended bonus schedule (loaded by default)

| Day | Window | Multiplier | Evidence |
|---|---|---|---|
| Sun | 11 AM–12 PM | 1.5× | 35 |
| Sun | 9–10 PM | 1.5× | 39 |
| Mon | 7–9 PM | 1.5× | 36, 33 |
| Mon | 9–10 PM | **2×** | 22 |
| Tue | 11 AM–12 PM | **2×** | 24 |
| Tue | 12–2 PM | 1.5× | 36, 36 |
| Tue | 9–10 PM | 1.5× | 31 |
| Wed | 11 AM–12 PM | **2×** | 27 |
| Wed | 12–1 PM | 1.5× | 31 |
| Wed | 3–6 PM | 1.5× | 38, 33, 37 |
| Wed | 8–9 PM | 1.5× | 33 |
| Wed | 9–10 PM | **2×** | 24 |
| Thu | 11 AM–12 PM | 1.5× | 33 |
| Thu | 3–5 PM | 1.5× | 36, 39 |
| Thu | 9–10 PM | 1.5× | 37 |
| Fri | 11 AM–12 PM | 1.5× | 38 |
| Fri | 2–4 PM | 1.5× | 37, 38 |
| Sat | 10–11 PM | 1.5× | 33 |

Safeguards: the bonus applies **once per member per day** (so a bill can't be split into several bonus visits), multipliers **never stack** with promotions, managers can **suspend all bonuses with one tap**, and the owner can edit any window.

### Information the screenshots cannot provide
To refine the schedule after launch we need: covers and sales by hour from the POS (Google's index is relative), staffing and labor cost by hour, seating capacity and table-turn time, the all-you-can-eat vs. à la carte mix by hour, seasonality and local events, and a before-and-after comparison to separate *new* visits from *shifted* ones.

---

## 3. Membership tiers

| Tier | Points per $1 | Qualifying lifetime spend (SAMPLE) | Benefits |
|---|---|---|---|
| Silver | 10 | $0 (on joining) | Marketplace, milestones, off-peak bonuses |
| Gold | 11 | $200 | +10% earn, Gold-exclusive rewards (e.g. The Woodlands Roll), Gold promotions |
| Platinum | 12 | $500 | Highest earn, Platinum-exclusive rewards (Unlimited Sushi), repeating milestones, owner selections |

- Tier is based on **qualifying lifetime spend**, not point balance. **Redeeming points never lowers the tier.**
- At a ~$50 average check (from the demo model; confirm with Ema's POS), Gold takes about 4 visits and Platinum about 10. That feels achievable but still meaningful. Thresholds are editable.

---

## 4. Points engine

```
eligible  = pre-tax subtotal  (tax and tips excluded by default; both configurable)
base      = floor(eligible × tier rate)
multiplier= max(off-peak window, approved campaign)   ← no stacking, capped at 2×
bonus     = floor(base × (multiplier − 1))
total     = base + bonus
```
Minimum qualifying purchase: $5. Examples from the brief, all covered by tests: $40 → 400 / 440 / 480. $30 Silver off-peak 1.5× → 450.

---

## 5. Reward economics

### Assumptions (editable)
| Input | Value | Basis |
|---|---|---|
| Food cost: beverages / appetizers / sushi / entrées / specialty | 20% / 30% / 34% / 32% / 40% | Typical full-service Japanese restaurant ranges; premium fish is higher |
| Fulfillment cost per reward | $0.25 | Packaging and prep time |
| Contribution margin | 60% | 1 − (≈32% food + ≈8% variable labor, packaging and card fees) |
| Target reward cost | 2.0% of qualifying sales | Used to price rewards |
| Maximum reward cost | 3.0% | Anything above it is flagged |
| Breakage | 20% | Share of points never redeemed |
| Monthly redemption budget | $2,500 food cost | Marketplace pauses above it |

### Pricing formula
```
variable cost = menu price × food cost % + $0.25
points        = round up to the nearest 50 ( variable cost ÷ 2.0% × 10 )
```
In words: a Silver member must spend **50× the reward's variable cost** before they can redeem it. Points are *not* a fixed dollar value. A point is worth about **$0.002 in cost** and **$0.005–0.008 in menu value** to the guest.

### Reward catalog (formula prices)
`*` = price to confirm. Cost rate is shown at the Silver / Platinum earn rate.

| Reward | Category | Menu price | Variable cost | Points | Silver spend needed | Menu value back | Cost rate (Silver / Plat.) |
|---|---|---|---|---|---|---|---|
| Soft Drink | beverages | $3.00 * | $0.85 | 450 | $45 | 6.7% | 1.89% / 2.27% |
| Japanese Soda | beverages | $4.00 * | $1.05 | 550 | $55 | 7.3% | 1.91% / 2.29% |
| Lychee Rose Green Tea | beverages | $5.00 * | $1.25 | 650 | $65 | 7.7% | 1.92% / 2.31% |
| Bubble Tea | beverages | $6.00 * | $1.45 | 750 | $75 | 8.0% | 1.93% / 2.32% |
| Edamame | appetizers | $5.00 | $1.75 | 900 | $90 | 5.6% | 1.94% / 2.33% |
| Spicy Garlic Edamame | appetizers | $5.00 | $1.75 | 900 | $90 | 5.6% | 1.94% / 2.33% |
| Fried Spring Roll | appetizers | $5.50 | $1.90 | 950 | $95 | 5.8% | 2.00% / 2.40% |
| Pork Gyoza | appetizers | $6.00 | $2.05 | 1,050 | $105 | 5.7% | 1.95% / 2.34% |
| Crab Puff | appetizers | $6.60 * | $2.23 | 1,150 | $115 | 5.7% | 1.94% / 2.33% |
| Crispy Sushi Rice | appetizers | $8.00 | $2.65 | 1,350 | $135 | 5.9% | 1.96% / 2.36% |
| Sake-Simmered Abalone | appetizers | $8.00 | $2.65 | 1,350 | $135 | 5.9% | 1.96% / 2.36% |
| Seven-Spiced Calamari | appetizers | $9.00 | $2.95 | 1,500 | $150 | 6.0% | 1.97% / 2.36% |
| Mini Ema Don | appetizers | $10.00 | $3.25 | 1,650 | $165 | 6.1% | 1.97% / 2.36% |
| Salmon Sushi (1 pc) | sushi | $2.50 | $1.10 | 550 | $55 | 4.5% | 2.00% / 2.40% |
| Unagi Sushi (1 pc) | sushi | $2.50 | $1.10 | 550 | $55 | 4.5% | 2.00% / 2.40% |
| California Roll | sushi | $6.00 | $2.29 | 1,150 | $115 | 5.2% | 1.99% / 2.39% |
| Spicy Tuna Roll | sushi | $7.00 | $2.63 | 1,350 | $135 | 5.2% | 1.95% / 2.34% |
| Volcano Roll | sushi | $13.20 * | $4.74 | 2,400 | $240 | 5.5% | 1.98% / 2.37% |
| Shaggy Dog Roll (Spicy) | sushi | $14.30 * | $5.11 | 2,600 | $260 | 5.5% | 1.97% / 2.36% |
| Flaming Lips Roll | sushi | $15.00 * | $5.35 | 2,700 | $270 | 5.6% | 1.98% / 2.38% |
| Astro Roll | sushi | $15.40 * | $5.49 | 2,750 | $275 | 5.6% | 2.00% / 2.40% |
| Houston Roll (Spicy) | sushi | $16.50 * | $5.86 | 2,950 | $295 | 5.6% | 1.99% / 2.38% |
| Captain America Roll | sushi | $16.50 * | $5.86 | 2,950 | $295 | 5.6% | 1.99% / 2.38% |
| Mini Spicy Miso Ramen | entrées | $8.80 | $3.07 | 1,550 | $155 | 5.7% | 1.98% / 2.38% |
| Chicken Fried Rice | entrées | $12.00 * | $4.09 | 2,050 | $205 | 5.9% | 2.00% / 2.39% |
| Chicken Yaki Udon | entrées | $12.00 * | $4.09 | 2,050 | $205 | 5.9% | 2.00% / 2.39% |
| Grilled Short Ribs | entrées | $15.40 * | $5.18 | 2,600 | $260 | 5.9% | 1.99% / 2.39% |
| Sashimi Combo | entrées | $25.90 | $8.54 | 4,300 | $430 | 6.0% | 1.99% / 2.38% |
| The Ema Roll | specialty | $17.60 | $7.29 | 3,650 | $365 | 4.8% | 2.00% / 2.40% |
| Boss Roll | specialty | $18.00 * | $7.45 | 3,750 | $375 | 4.8% | 1.99% / 2.38% |
| Chu Toro Sushi (1 pc) | specialty | $5.00 | $2.25 | 1,150 | $115 | 4.3% | 1.96% / 2.35% |
| Toro Sushi (1 pc) | specialty | $7.00 | $3.05 | 1,550 | $155 | 4.5% | 1.97% / 2.36% |
| Wagyu Sushi (1 pc) | specialty | $10.00 | $4.25 | 2,150 | $215 | 4.7% | 1.98% / 2.37% |
| Blue Fin Tuna Sashimi | specialty | $13.00 | $5.45 | 2,750 | $275 | 4.7% | 1.98% / 2.38% |
| The Woodlands Roll (Gold+) | exclusive | $22.00 * | $9.05 | 4,550 | $455 | 4.8% | 1.99% / 2.39% |
| Unlimited Sushi – Classic (Platinum) | exclusive | $39.95 * | $16.23 | 8,150 | $815 | 4.9% | 1.99% / 2.39% |

Every reward stays under the 3% maximum even at the Platinum rate (2.4%).

### Cost per $1 of spend by tier and period (≈ $0.002 cost per point)
| Tier | Standard | 1.5× off-peak | 2× off-peak | Net of 20% breakage (standard) |
|---|---|---|---|---|
| Silver (10) | 2.0% | 3.0% | 4.0% | 1.6% |
| Gold (11) | 2.2% | 3.3% | 4.4% | 1.8% |
| Platinum (12) | 2.4% | 3.6% | 4.8% | 1.9% |

### Milestone gifts (free, automatic, inside each tier)
| Tier | Milestones (points earned in tier) | Total cost | Over ≈ spend | Extra cost rate |
|---|---|---|---|---|
| Silver | 600 → Soft Drink · 1,500 → Edamame | $2.60 | $150 | 1.7% |
| Gold | 1,100 → Japanese Soda · 2,750 → Pork Gyoza | $3.10 | $250 | 1.2% |
| Platinum (repeats every 6,000) | 2,400 → Crispy Sushi Rice · 6,000 → The Ema Roll | $9.94 | $500 | 2.0% |

Thresholds are sized so every milestone can be reached **before** the next tier (Silver spans about 2,000 points, Gold about 3,300).

### Other engagement costs
- **Visit streaks** (2 / 4 / 6 visits in a month → 100 / 250 / 500 pts). At most 850 pts a month ≈ **$1.70 cost** for a guest who visited 6 times (≈$300 spend) = 0.6%.
- **Referral:** 500 pts to the referrer and 250 to the new member, paid only after the new member's first purchase of $15+. Total ≈ $1.50 cost to acquire a new guest.
- **Birthday treat:** one Crispy Sushi Rice ($2.65 cost) a year.

### All-in reward cost (Silver, standard hours)
2.0% marketplace + ~1.7% milestones + ~0.3% streaks/birthday ≈ **4% of member sales before breakage**, or **about 3.2% after 20% breakage**. That is within the range commonly cited for quick-service and casual-dining loyalty programs. The owner can tighten it by raising point prices or milestone thresholds.

---

## 6. Incremental profitability

```
Incremental contribution profit =
    incremental revenue × contribution margin
  − incremental reward costs (all member sales × reward cost rate, plus the extra off-peak bonus cost)
  − promotion and marketing costs
  − other program costs (hosting, printing, training)
```

**Example projection (simulator defaults, hypothetical, not measured):** 500 active members, 6 visits a year, $45 check, +12% visits, +3% check size, 60% contribution margin, 10.6 blended points per $1 at $0.002 per point, +2% of sales for milestones, streaks and birthday gifts, 20% breakage, 20% of visits in off-peak windows at a 1.6× average with 40% of those genuinely new, $1,000 marketing, $1,200 hosting/printing/training.

| | Amount |
|---|---|
| Scenario 1 revenue (no program) | $135,000 |
| Scenario 2 revenue (with program) | $168,195 |
| Incremental revenue | $33,195 |
| × 60% contribution margin | $19,917 |
| − Reward costs (all member sales, incl. off-peak bonus) | −$5,749 |
| − Marketing and other program costs | −$2,200 |
| **= Incremental contribution profit (projected)** | **≈ $11,968 / year** |

**Stress test:** with no new off-peak guests (every bonus visit is just shifted) and no check-size lift, the program needs a **≈ 9.5% visit lift** to break even. That number is the target to validate after launch. Every input can be changed live in **Owner → Profit Simulator**.

The model is deliberately **conservative**: reward cost is charged on *all* member sales, including visits that would have happened anyway, and moving visits out of peak hours is valued at $0 unless the owner changes it.

**We do not claim the program is profitable.** It is profitable only if the measured visit lift exceeds the break-even shown in the simulator. After launch, compare total restaurant sales and covers in the bonus windows against the same weeks before launch, or alternate bonus weeks, to measure the real effect.

---

## 7. Financial and security controls

- Maximum reward cost rate with automatic flags (Financials, Rewards & Pricing, Program Settings).
- Monthly redemption budget: the marketplace pauses automatically when it is reached.
- Promotions capped at 2×, no stacking, owner approval required; managers can suspend them.
- Off-peak bonuses: one per member per day, plus an instant suspend switch.
- Reward availability, eligibility tier and point price are controlled per item.
- Point expiry after 12 inactive months and reward codes valid for 30 days. **The terms are a draft and need legal review** (Texas law and any gift-card rules).
- Only staff can record purchases. Customers cannot add purchases or points.
- QR codes are HMAC-signed, expire after 10 minutes, contain no personal data, and can be revoked by the member.
- Duplicate prevention: idempotency keys, one post per check number per day, same-amount confirmation.
- Every point change is a ledger row. Reversals keep the original record and write an audit entry with a reason.
- Role-based access: customer → employee → manager → owner (see Owner → Staff Accounts for the full matrix).

---

## 8. Additional features implemented
- Customer segmentation (New, Regular, VIP, At risk, Lapsed) and a 0–100 engagement score.
- Automatic detection of lapsed regulars (at risk after 45+ days) with win-back suggestions.
- VIP recognition lists: most frequent, highest spend, longest members, off-peak champions.
- Rule-based promotion recommendations on the owner overview.
- A 90-day redemption forecast based on the recent redemption pace.
- A heatmap comparing the Google baseline with actual member visits by day and hour.
- Customer lifetime value tracking (historical spend plus a projected value over 3 years).
- A printable desk/table QR poster that always points to the deployed address.

## 9. Measured vs. projected vs. demo
| Label in app | Meaning |
|---|---|
| **DEMO** chip / banner | Hypothetical sample members and transactions generated for presentations |
| "projection", "estimate", "assumption" | Calculated from editable assumptions, not observed |
| Everything else, with demo data toggled off | Actual recorded program activity |
