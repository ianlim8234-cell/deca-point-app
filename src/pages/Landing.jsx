import { Link } from 'react-router-dom';
import { useAuth, useConfig, hasRole } from '../lib/auth.jsx';
import { Logo, TierBadge } from '../components/ui.jsx';
import FoodArt from '../components/FoodArt.jsx';
import { OffpeakSchedule, OffpeakNowBanner } from '../components/Schedule.jsx';
import { money, pts, money0 } from '../lib/format.js';

export function PublicNav() {
  const { user } = useAuth();
  const home = user ? (user.role === 'customer' ? '/app' : hasRole(user, 'manager') ? '/admin' : '/staff') : null;
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/">
          <Logo light />
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/program" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-washi/80 hover:text-washi sm:block">
            How it works
          </Link>
          {home ? (
            <Link to={home} className="btn bg-washi text-ink hover:bg-white">
              My account
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-washi/90 hover:text-washi">
                Sign in
              </Link>
              <Link to="/join" className="btn-beni">
                Join free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function Landing() {
  const { config } = useConfig();
  const tiers = config?.tiers || [];
  const featured = (config?.rewards || []).filter((r) => ['edamame', 'pork-gyoza', 'crispy-sushi-rice', 'ema-roll', 'spicy-tuna-roll', 'mini-spicy-miso-ramen'].includes(r.id));
  return (
    <div className="min-h-screen bg-washi">
      {/* HERO */}
      <section className="seigaiha relative overflow-hidden text-washi">
        <PublicNav />
        <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-beni opacity-90 blur-[1px] sm:h-[28rem] sm:w-[28rem]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-28 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pb-24 md:pt-36">
          <div className="animate-rise">
            <div className="eyebrow text-washi/60">Ema Japanese Cuisine · The Woodlands, TX</div>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] sm:text-6xl">
              Every visit
              <br />
              brings you closer.
            </h1>
            <p className="mt-5 max-w-lg text-base text-washi/80 sm:text-lg">
              Join Ema Rewards free. Earn <b className="text-washi">10–12 points per dollar</b>, unlock free dishes from our real menu, and get up to{' '}
              <b className="text-washi">2× points</b> when you dine during our quiet hours.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/join" className="btn-beni btn-lg">
                Create my free account
              </Link>
              <Link to="/login" className="btn btn-lg border border-washi/30 text-washi hover:bg-washi/10">
                I’m a member
              </Link>
            </div>
            <div className="mt-6 text-xs text-washi/50">Takes 30 seconds · No app download · Show your QR code at checkout</div>
          </div>
          {/* membership card preview */}
          <div className="relative mx-auto w-full max-w-sm animate-rise [animation-delay:120ms] md:mt-6">
            <div className="tier-gold relative aspect-[1.6] w-full overflow-hidden rounded-3xl p-5 shadow-lift">
              <div className="sheen absolute inset-0 animate-sheen" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <Logo size="sm" />
                  <span className="text-xs font-bold uppercase tracking-widest">Gold</span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Points balance</div>
                  <div className="font-display text-4xl font-bold">2,640</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-black/10">
                    <div className="h-1.5 w-3/4 rounded-full bg-[#2a1f0e]" />
                  </div>
                  <div className="mt-1 text-[11px] font-medium opacity-70">$375 / $500 toward Platinum</div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 rounded-2xl bg-paper px-4 py-3 text-ink shadow-lift">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Milestone unlocked</div>
              <div className="font-semibold">🎁 Free Pork Gyoza</div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <OffpeakNowBanner config={config} />

        {/* HOW IT WORKS */}
        <section>
          <div className="eyebrow">How it works</div>
          <h2 className="mt-1 font-display text-3xl font-bold">Three steps. That’s it.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Scan & join', 'Scan the QR code at our host stand and create your free account in seconds.'],
              ['02', 'Show your code', 'At checkout, show your personal Ema Rewards QR code. Staff scan it and your points post instantly.'],
              ['03', 'Enjoy rewards', 'Redeem points for real menu favorites, from edamame to The Ema Roll, plus surprise milestone gifts.'],
            ].map(([n, t, d]) => (
              <div key={n} className="card p-6">
                <div className="font-display text-3xl font-bold text-beni">{n}</div>
                <div className="mt-2 text-lg font-semibold">{t}</div>
                <p className="mt-1 text-sm text-ink-3">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TIERS */}
        <section>
          <div className="eyebrow">Membership tiers</div>
          <h2 className="mt-1 font-display text-3xl font-bold">The more you visit, the more you earn.</h2>
          <p className="mt-2 max-w-2xl text-ink-3">Your tier is based on qualifying lifetime spending, and redeeming points never lowers it.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {tiers.map((t, i) => (
              <div key={t.key} className={`tier-${t.key} relative overflow-hidden rounded-3xl p-6 shadow-card`}>
                <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Tier {i + 1}</div>
                <div className="mt-1 font-display text-3xl font-bold">{t.name}</div>
                <div className="mt-6 font-display text-5xl font-bold">
                  {t.rate}
                  <span className="ml-1 font-sans text-base font-semibold opacity-70">pts / $1</span>
                </div>
                <div className="mt-4 text-sm opacity-80">{t.minSpend === 0 ? 'Starts the moment you join' : `Unlocks at ${money0(t.minSpend)} lifetime spending`}</div>
                <ul className="mt-4 space-y-1 text-sm opacity-90">
                  {i === 0 && (<><li>• Full rewards marketplace</li><li>• Milestone gifts and Quiet Hours bonuses</li></>)}
                  {i === 1 && (<><li>• 10% more points than Silver</li><li>• Gold-exclusive rewards and promotions</li></>)}
                  {i === 2 && (<><li>• Our highest earning rate</li><li>• Owner’s selections, events and priority offers</li></>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* OFF PEAK */}
        <section className="grid gap-8 md:grid-cols-[1fr_1.3fr]">
          <div>
            <div className="eyebrow">Quiet Hours Bonus</div>
            <h2 className="mt-1 font-display text-3xl font-bold">Dine when it’s calm. Earn up to 2×.</h2>
            <p className="mt-3 text-ink-3">
              We picked these windows from our real weekly traffic pattern. They are the hours when our dining room is quietest, service is unhurried, and your table is ready.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="chip bg-kin-soft text-[#6b4f1d]">1.5× Quiet hour</span>
              <span className="chip bg-beni text-white">2× Our calmest hours</span>
            </div>
            <p className="mt-4 text-xs text-ink-4">The bonus applies once per member per day. Busy hours such as Friday and Saturday evenings earn standard points.</p>
          </div>
          <OffpeakSchedule windows={config?.offpeak?.windows || []} activeNow={config?.offpeak?.activeNow} />
        </section>

        {/* REWARDS PREVIEW */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Rewards marketplace</div>
              <h2 className="mt-1 font-display text-3xl font-bold">Real dishes. Real rewards.</h2>
            </div>
            <Link to="/join" className="hidden text-sm font-semibold text-beni hover:underline sm:block">
              See all rewards →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {featured.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <div className="aspect-square">
                  <FoodArt category={r.category} imageUrl={r.imageUrl} name={r.name} />
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold leading-tight">{r.name}</div>
                  <div className="mt-1 text-xs text-ink-3">{money(r.price)} on the menu</div>
                  <div className="mt-2 font-display text-lg font-bold text-beni">{pts(r.points)} pts</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="seigaiha overflow-hidden rounded-3xl p-8 text-center text-washi sm:p-12">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Your next visit could earn a free appetizer.</h2>
          <p className="mx-auto mt-3 max-w-xl text-washi/70">New Silver members unlock a free beverage at 600 points and a free appetizer at 1,500.</p>
          <Link to="/join" className="btn-beni btn-lg mt-6">
            Join Ema Rewards
          </Link>
        </section>
      </main>

      <footer className="border-t border-washi-2 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-ink-3 sm:px-6 md:flex-row md:justify-between">
          <div>
            <Logo size="sm" />
            <div className="mt-3">{config?.restaurant?.name}</div>
            <div>{config?.restaurant?.address}</div>
            <div>{config?.restaurant?.phone}</div>
          </div>
          <div className="flex flex-col gap-2">
            <a href={config?.restaurant?.orderUrl} target="_blank" rel="noreferrer" className="hover:text-ink">Order online ↗</a>
            <Link to="/program" className="hover:text-ink">About the program</Link>
            <Link to="/staff" className="hover:text-ink">Staff portal</Link>
            <Link to="/admin" className="hover:text-ink">Owner dashboard</Link>
          </div>
          <div className="max-w-xs text-xs text-ink-4">
            Ema Rewards is a loyalty program prototype developed for a DECA Hospitality & Tourism Operations Research project. The {tiers.length ? 'tier thresholds and point values' : 'values'} shown are
            proposals pending owner approval.
          </div>
        </div>
      </footer>
    </div>
  );
}

export { TierBadge };
