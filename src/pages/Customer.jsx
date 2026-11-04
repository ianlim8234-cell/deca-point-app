import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth, useConfig } from '../lib/auth.jsx';
import { Logo, Progress, TierBadge, PageLoader, Modal, Alert, Empty, Field, Celebration, useToast, Spinner, DemoBanner } from '../components/ui.jsx';
import { QrImage } from '../components/Qr.jsx';
import FoodArt from '../components/FoodArt.jsx';
import { OffpeakSchedule, OffpeakNowBanner } from '../components/Schedule.jsx';
import { CATEGORIES } from '../../shared/menu.js';
import { fmtTime } from '../../shared/engine.js';
import { money, money0, pts, date, dateShort, dateTime, ago, DAY_NAMES } from '../lib/format.js';

const useCustomer = () => useOutletContext();

// ----------------------------------------------------------------------------- layout
const TABS = [
  { to: '/app', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', end: true },
  { to: '/app/card', label: 'My Code', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z' },
  { to: '/app/rewards', label: 'Rewards', icon: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z' },
  { to: '/app/history', label: 'Activity', icon: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  { to: '/app/account', label: 'Account', icon: 'M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' },
];

function Icon({ d, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function CustomerLayout() {
  const { config, refreshConfig } = useConfig();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [bell, setBell] = useState(false);
  const [celebrate, setCelebrate] = useState(null);

  const reload = useCallback(async () => {
    try {
      const d = await api('/customer/summary');
      setData(d);
      // Celebrate milestone, tier and owner notifications that this browser has not shown yet.
      let seen = 0;
      try { seen = Number(localStorage.getItem(`ema-seen-${d.profile.id}`) || 0); } catch { /* storage blocked */ }
      const fresh = d.notifications.filter((n) => n.id > seen && ['milestone', 'tier', 'owner', 'birthday'].includes(n.kind));
      if (seen && fresh.length) setCelebrate({ title: fresh[0].title, subtitle: fresh[0].body });
      try { localStorage.setItem(`ema-seen-${d.profile.id}`, String(Math.max(seen, ...d.notifications.map((n) => n.id), 1))); } catch { /* ignore */ }
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(() => {
      reload();
      refreshConfig().catch(() => {});
    }, 30000);
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [reload, refreshConfig]);

  const openBell = async () => {
    setBell(true);
    if (data?.unread) {
      await api('/customer/notifications/read', { method: 'POST', body: {} }).catch(() => {});
      setData((d) => ({ ...d, unread: 0, notifications: d.notifications.map((n) => ({ ...n, read: 1 })) }));
    }
  };

  if (err) return <div className="p-8"><Alert>{err}</Alert></div>;
  if (!data || !config) return <PageLoader />;

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-washi-2 bg-washi/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/app"><Logo size="sm" /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-washi' : 'text-ink-3 hover:text-ink'}`}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={openBell} className="relative rounded-xl p-2 hover:bg-washi-2" aria-label="Notifications">
            <Icon d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" className="h-6 w-6" />
            {data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-beni px-1 text-[10px] font-bold text-white">{data.unread}</span>}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {data.profile.isDemo && <div className="mb-4"><DemoBanner>This is a demonstration account with sample purchases.</DemoBanner></div>}
        <Outlet context={{ data, config, reload }} />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-washi-2 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-beni' : 'text-ink-3'}`}>
              <Icon d={t.icon} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Modal open={bell} onClose={() => setBell(false)} title="Notifications">
        {data.notifications.length === 0 ? (
          <Empty title="You’re all caught up" />
        ) : (
          <ul className="divide-y divide-washi-2">
            {data.notifications.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{n.title}</div>
                  <div className="shrink-0 text-xs text-ink-4">{ago(n.created_at)}</div>
                </div>
                {n.body && <div className="mt-0.5 text-sm text-ink-3">{n.body}</div>}
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Celebration show={!!celebrate} title={celebrate?.title} subtitle={celebrate?.subtitle} onDone={() => setCelebrate(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------------- shared bits
function MemberCard({ data, onShowCode }) {
  const t = data.tier;
  return (
    <div className={`tier-${t.key} relative overflow-hidden rounded-3xl p-5 shadow-lift sm:p-6`}>
      <div className="sheen pointer-events-none absolute inset-0 animate-sheen opacity-60" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Welcome back</div>
          <div className="font-display text-2xl font-bold sm:text-3xl">{data.profile.firstName} {data.profile.lastName}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em]">◆ {t.name} Member · {t.rate} pts / $1</div>
        </div>
        <button onClick={onShowCode} className="shrink-0 rounded-2xl bg-white p-2 shadow-card transition hover:scale-105" aria-label="Show my QR code">
          <Icon d={TABS[1].icon} className="mx-auto h-12 w-12 text-ink" />
          <div className="mt-1 text-center text-[10px] font-bold text-ink">MY CODE</div>
        </button>
      </div>
      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Available points</div>
          <div className="font-display text-5xl font-bold leading-none">{pts(data.points.balance)}</div>
        </div>
        <div className="text-right text-xs font-medium opacity-70">
          <div>{data.profile.memberId}</div>
          <div>Member since {date(data.profile.memberSince)}</div>
        </div>
      </div>
    </div>
  );
}

export function TierProgressCard({ data }) {
  const nt = data.nextTier;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Tier progress</div>
        <TierBadge tier={data.tier} />
      </div>
      {nt ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="font-display text-2xl font-bold">
              {money0(data.spend)} <span className="text-base font-semibold text-ink-3">/ {money0(nt.minSpend)}</span>
            </div>
            <div className="text-sm font-semibold text-ink-3">toward {nt.name}</div>
          </div>
          <Progress value={(data.spend - data.tier.minSpend) / (nt.minSpend - data.tier.minSpend)} className="mt-3" height="h-3" color={nt.key === 'platinum' ? 'bg-ai' : 'bg-kin'} />
          <div className="mt-3 text-sm">
            <b>{money(nt.remaining)}</b> in qualifying purchases to reach <b>{nt.name}</b>, where you earn <b>{nt.rate} pts per $1</b> (+{Math.round(((nt.rate - data.tier.rate) / data.tier.rate) * 100)}% more).
          </div>
        </>
      ) : (
        <div className="mt-3">
          <div className="font-display text-2xl font-bold">You’ve reached our highest tier</div>
          <div className="mt-1 text-sm text-ink-3">{money0(data.spend)} lifetime qualifying spend · earning {data.tier.rate} pts per $1</div>
        </div>
      )}
    </div>
  );
}

export function MilestoneCard({ data, config }) {
  const ms = data.milestones;
  const next = ms.next;
  const reward = next && config.rewards.find((r) => r.id === next.rewardId);
  const span = next ? next.points - (ms.prevPoints || 0) : 1;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Next milestone gift</div>
        <Link to="/app/milestones" className="text-xs font-semibold text-beni hover:underline">All milestones</Link>
      </div>
      {next ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <FoodArt category={reward?.category} imageUrl={reward?.imageUrl} name={reward?.name} />
            </div>
            <div>
              <div className="font-semibold">{next.label}</div>
              <div className="text-sm text-ink-3">{reward?.name}</div>
            </div>
          </div>
          <Progress value={(ms.progressPoints - (ms.prevPoints || 0)) / span} className="mt-4" height="h-3" />
          <div className="mt-2 flex justify-between text-sm">
            <span><b>{pts(next.points - ms.progressPoints)}</b> points to go</span>
            <span className="text-ink-3">{pts(ms.progressPoints)} / {pts(next.points)}</span>
          </div>
          <div className="mt-1 text-xs text-ink-4">Milestones unlock automatically and never cost you points.</div>
        </>
      ) : (
        <div className="mt-3 text-sm text-ink-3">You’ve unlocked every {data.tier.name} milestone. Reach the next tier for new gifts.</div>
      )}
    </div>
  );
}

function VoucherRow({ v, onOpen }) {
  const src = { marketplace: 'Redeemed', milestone: 'Milestone gift', owner: 'Owner’s reward', birthday: 'Birthday treat' }[v.source] || v.source;
  return (
    <button onClick={() => onOpen?.(v)} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-washi-2 bg-paper px-3 py-2.5 text-left hover:border-beni/40">
      <div className="min-w-0">
        <div className="truncate font-semibold">{v.reward_name}</div>
        <div className="text-xs text-ink-3">{src} · expires {dateShort(v.expires_at)}</div>
      </div>
      <span className="chip shrink-0 bg-matcha-soft text-matcha">Ready</span>
    </button>
  );
}

export function VoucherModal({ v, onClose }) {
  return (
    <Modal open={!!v} onClose={onClose} title={v?.reward_name}>
      {v && (
        <div className="text-center">
          <p className="text-sm text-ink-3">Show this code to your server at checkout.</p>
          <div className="mx-auto mt-4 inline-block rounded-2xl bg-white p-3 shadow-card">
            <QrImage value={v.code} size={200} />
          </div>
          <div className="mt-3 font-mono text-2xl font-bold tracking-wider">{v.code}</div>
          <div className="mt-1 text-sm text-ink-3">Valid until {date(v.expires_at)} · single use</div>
          {v.note && <div className="mt-3 rounded-xl bg-washi px-3 py-2 text-sm italic">“{v.note}”</div>}
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------- dashboard
export function Dashboard() {
  const { data, config } = useCustomer();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [voucher, setVoucher] = useState(null);
  const ready = data.vouchers.filter((v) => v.status === 'issued');
  const exclusive = ready.filter((v) => v.source === 'owner' || v.source === 'birthday');
  const nextWindow = useMemo(() => nextOffpeak(config), [config]);

  return (
    <div className="space-y-5">
      {params.get('welcome') && (
        <div className="card flex animate-rise items-start justify-between gap-4 border-beni/30 p-4">
          <div>
            <div className="font-semibold">Welcome to Ema Rewards, {data.profile.firstName}! 🎉</div>
            <div className="text-sm text-ink-3">Show your QR code at checkout to earn your first points today.</div>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={() => setParams({})}>✕</button>
        </div>
      )}

      <div className="animate-rise">
        <MemberCard data={data} onShowCode={() => nav('/app/card')} />
      </div>
      <OffpeakNowBanner config={config} />

      {/* points section */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Lifetime earned" value={pts(data.points.lifetime)} />
        <MiniStat label="Earned this month" value={pts(data.points.thisMonth)} />
        <MiniStat label="Points spent" value={pts(data.points.spent)} />
        <MiniStat label="Visits" value={data.visits} sub={`${data.monthVisits} this month`} />
      </div>

      {data.nextReward && (
        <Link to="/app/rewards" className="card flex items-center justify-between gap-3 p-4 hover:border-beni/40">
          <div className="text-sm">
            <span className="font-semibold">{pts(data.nextReward.needed)} more points</span> <span className="text-ink-3">until you can redeem</span> <span className="font-semibold">{data.nextReward.name}</span>
          </div>
          <span className="text-beni">→</span>
        </Link>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <TierProgressCard data={data} />
        <MilestoneCard data={data} config={config} />
      </div>

      {/* rewards ready */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">My rewards</div>
            <div className="font-display text-xl font-bold">{ready.length ? `${ready.length} ready to enjoy` : 'Nothing ready yet'}</div>
          </div>
          <Link to="/app/rewards" className="btn-outline">Browse rewards</Link>
        </div>
        {ready.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
            {ready.slice(0, 6).map((v) => <VoucherRow key={v.id} v={v} onOpen={setVoucher} />)}
          </div>
        )}
      </section>

      {/* exclusive */}
      {exclusive.length > 0 && (
        <Link to="/app/exclusive" className="seigaiha block overflow-hidden rounded-3xl p-5 text-washi shadow-card">
          <div className="eyebrow text-kin">Ema Exclusive · Owner’s Rewards</div>
          <div className="mt-1 font-display text-xl font-bold">{exclusive[0].reward_name}</div>
          {exclusive[0].note && <div className="mt-1 text-sm italic text-washi/70">“{exclusive[0].note}”</div>}
          <div className="mt-3 text-sm font-semibold text-kin">View exclusive rewards →</div>
        </Link>
      )}

      {/* promos */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <div className="eyebrow">Upcoming bonus opportunities</div>
          <ul className="mt-3 space-y-2 text-sm">
            {nextWindow && (
              <li className="flex items-center justify-between gap-2 rounded-xl bg-washi px-3 py-2">
                <span><b>Quiet Hours {nextWindow.multiplier}×</b> · {nextWindow.label}</span>
              </li>
            )}
            {data.campaigns.map((c) => (
              <li key={c.id} className="rounded-xl bg-beni-soft/60 px-3 py-2">
                <b>{c.name}</b> · {c.multiplier}× points · {dateShort(c.start_at)}–{dateShort(c.end_at)}
              </li>
            ))}
            {config.streaks.enabled && (
              <li className="rounded-xl bg-washi px-3 py-2">
                <b>Visit streak</b> · {data.monthVisits} visit{data.monthVisits === 1 ? '' : 's'} this month.{' '}
                {(() => {
                  const nx = config.streaks.levels.find((l) => l.visits > data.monthVisits);
                  return nx ? `${nx.visits - data.monthVisits} more for +${nx.points} pts` : 'All streak bonuses earned this month!';
                })()}
              </li>
            )}
          </ul>
          <Link to="/app/tiers" className="mt-3 inline-block text-xs font-semibold text-beni hover:underline">See the full Quiet Hours schedule →</Link>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Recent activity</div>
            <Link to="/app/history" className="text-xs font-semibold text-beni hover:underline">View all</Link>
          </div>
          {data.transactions.length === 0 ? (
            <div className="mt-3 text-sm text-ink-3">Your purchases will appear here after your first visit.</div>
          ) : (
            <ul className="mt-2 divide-y divide-washi-2">
              {data.transactions.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-semibold">{money(t.eligible_amount)}</div>
                    <div className="text-xs text-ink-3">
                      {dateShort(t.created_at)} · {t.base_points} base{t.offpeak_bonus ? ` + ${t.offpeak_bonus} off-peak` : ''}{t.promo_bonus ? ` + ${t.promo_bonus} promo` : ''}
                    </div>
                  </div>
                  <div className={`font-display text-lg font-bold ${t.status === 'reversed' ? 'text-ink-4 line-through' : 'text-matcha'}`}>+{pts(t.total_points)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Link to="/app/tiers" className="card p-4 text-center text-sm font-semibold hover:border-beni/40">Tiers & Quiet Hours</Link>
        <Link to="/app/milestones" className="card p-4 text-center text-sm font-semibold hover:border-beni/40">Milestones</Link>
        <Link to="/app/exclusive" className="card p-4 text-center text-sm font-semibold hover:border-beni/40">Ema Exclusive</Link>
      </div>
      <VoucherModal v={voucher} onClose={() => setVoucher(null)} />
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

function nextOffpeak(config) {
  const ws = config?.offpeak?.windows || [];
  if (!ws.length || config.offpeak.suspended || !config.offpeak.enabled) return null;
  if (config.offpeak.activeNow) return { ...config.offpeak.activeNow, label: `now until ${fmtTime(config.offpeak.activeNow.end)}` };
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: config.restaurant.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  const mins = Number(p.hour) * 60 + Number(p.minute);
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const cands = ws
      .filter((w) => Number(w.day) === d)
      .filter((w) => i > 0 || Number(w.start.slice(0, 2)) * 60 + Number(w.start.slice(3)) > mins)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (cands.length) {
      const w = cands[0];
      return { ...w, label: `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d]} ${fmtTime(w.start)}–${fmtTime(w.end)}` };
    }
  }
  return null;
}

// ----------------------------------------------------------------------------- QR card
export function CardPage() {
  const { data, reload } = useCustomer();
  const [qr, setQr] = useState(null);
  const [left, setLeft] = useState(0);
  const [voucher, setVoucher] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api('/customer/qr');
    setQr(r);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!qr) return;
    const tick = () => {
      const s = Math.max(0, Math.round((qr.expiresAt - Date.now()) / 1000));
      setLeft(s);
      if (s <= 60) load(); // refresh shortly before the code expires
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qr, load]);

  // Poll for new points while the code is on screen, so the guest sees them post right away.
  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);

  const ready = data.vouchers.filter((v) => v.status === 'issued');
  const rotate = async () => {
    const r = await api('/customer/refresh-qr', { method: 'POST', body: {} });
    setQr(r);
    toast('New code generated. Old codes no longer work.');
  };

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className={`tier-${data.tier.key} rounded-3xl p-6 text-center shadow-lift`}>
        <div className="flex items-center justify-between text-left">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">◆ {data.tier.name}</div>
            <div className="font-display text-xl font-bold">{data.profile.firstName} {data.profile.lastName}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase opacity-70">Points</div>
            <div className="font-display text-2xl font-bold">{pts(data.points.balance)}</div>
          </div>
        </div>
        <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-4 shadow-card">
          {qr ? <QrImage value={qr.token} size={240} /> : <div className="flex h-[240px] w-[240px] items-center justify-center"><Spinner /></div>}
        </div>
        <div className="mt-3 font-mono text-sm font-semibold tracking-wider">{data.profile.memberId}</div>
        <div className="mt-1 text-xs opacity-70">Secure code refreshes automatically · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
      </div>
      <div className="card p-4 text-sm text-ink-3">
        <b className="text-ink">At checkout:</b> show this code to your server before paying. Staff scan it, enter your verified check total, and your points post right away.
        The code contains no personal information and expires after 10 minutes.
      </div>

      {ready.length > 0 && (
        <div className="card p-4">
          <div className="eyebrow mb-2">Rewards to use today</div>
          <div className="space-y-2">{ready.map((v) => <VoucherRow key={v.id} v={v} onOpen={setVoucher} />)}</div>
        </div>
      )}
      <button onClick={rotate} className="btn-ghost w-full text-xs text-ink-3">Lost your phone or shared a screenshot? Generate a new secure code</button>
      <VoucherModal v={voucher} onClose={() => setVoucher(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------------- marketplace
const RANK = { silver: 0, gold: 1, platinum: 2 };

export function Marketplace() {
  const { data, config, reload } = useCustomer();
  const [cat, setCat] = useState('all');
  const [onlyAfford, setOnlyAfford] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const list = config.rewards
    .filter((r) => cat === 'all' || r.category === cat)
    .filter((r) => !onlyAfford || (r.points <= data.points.balance && RANK[data.tier.key] >= RANK[r.minTier]))
    .sort((a, b) => a.points - b.points);

  const redeem = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api('/customer/redeem', { method: 'POST', body: { rewardId: confirm.id } });
      setResult(r);
      setConfirm(null);
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Rewards marketplace</div>
          <h1 className="font-display text-3xl font-bold">Treat yourself</h1>
        </div>
        <div className="rounded-2xl bg-ink px-4 py-2 text-washi">
          <span className="text-xs uppercase tracking-wider text-washi/60">Balance </span>
          <span className="font-display text-xl font-bold">{pts(data.points.balance)}</span>
        </div>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ key: 'all', label: 'All' }, ...CATEGORIES].map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c.key ? 'bg-ink text-washi' : 'bg-paper text-ink-3 hover:text-ink'}`}>
            {c.label}
          </button>
        ))}
        <button onClick={() => setOnlyAfford((x) => !x)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${onlyAfford ? 'bg-matcha text-white' : 'bg-paper text-ink-3'}`}>
          ✓ I can redeem
        </button>
      </div>

      {list.length === 0 ? (
        <Empty title="No rewards match">Try another category or turn off the “I can redeem” filter.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const tierOk = RANK[data.tier.key] >= RANK[r.minTier];
            const need = r.points - data.points.balance;
            return (
              <div key={r.id} className="card flex flex-col overflow-hidden">
                <div className="relative aspect-[5/2] sm:aspect-[16/10]">
                  <FoodArt category={r.category} imageUrl={r.imageUrl} name={r.name} />
                  {r.minTier !== 'silver' && <span className="absolute left-3 top-3"><TierBadge tier={r.minTier} /></span>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold leading-tight">{r.name}</div>
                    <div className="shrink-0 text-right font-display text-xl font-bold text-beni">{pts(r.points)}<span className="ml-0.5 text-xs font-sans font-semibold text-ink-3">pts</span></div>
                  </div>
                  <p className="mt-1 flex-1 text-sm text-ink-3">{r.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <span>Menu price {money(r.price)}</span>
                    {r.priceStatus !== 'verified' && <span className="chip bg-kin-soft text-[#6b4f1d]" title="Price to be confirmed with the restaurant">price to confirm</span>}
                    <span>· {r.minTier === 'silver' ? 'All members' : `${r.minTier[0].toUpperCase() + r.minTier.slice(1)}+`}</span>
                  </div>
                  <button className="btn-primary mt-3 w-full" disabled={!tierOk || need > 0} onClick={() => { setErr(''); setConfirm(r); }}>
                    {!tierOk ? `${r.minTier[0].toUpperCase() + r.minTier.slice(1)} members only` : need > 0 ? `${pts(need)} more points needed` : 'Redeem'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Redeem this reward?">
        {confirm && (
          <div>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl"><FoodArt category={confirm.category} imageUrl={confirm.imageUrl} name={confirm.name} /></div>
              <div>
                <div className="font-semibold">{confirm.name}</div>
                <div className="text-sm text-ink-3">{pts(confirm.points)} points · balance after: {pts(data.points.balance - confirm.points)}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-3">
              You’ll get a single-use code that is valid for {config.expiration.rewardValidDays} days. Show it to your server on your next visit. Points are deducted now.
            </p>
            <div className="mt-3"><Alert>{err}</Alert></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-beni" onClick={redeem} disabled={busy}>{busy ? <Spinner /> : 'Confirm'}</button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!result} onClose={() => setResult(null)} title="Enjoy! 🎉">
        {result && (
          <div className="text-center">
            <div className="font-semibold">{result.reward.name}</div>
            <div className="mx-auto mt-3 inline-block rounded-2xl bg-white p-3 shadow-card animate-pop"><QrImage value={result.code} size={200} /></div>
            <div className="mt-3 font-mono text-2xl font-bold tracking-wider">{result.code}</div>
            <div className="mt-1 text-sm text-ink-3">Valid until {date(result.expires)} · find it anytime under Home → My rewards</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------- tiers
export function TiersPage() {
  const { data, config } = useCustomer();
  const [amount, setAmount] = useState(40);
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Membership</div>
        <h1 className="font-display text-3xl font-bold">Tiers & earning</h1>
      </div>
      <TierProgressCard data={data} />
      <div className="grid gap-4 md:grid-cols-3">
        {config.tiers.map((t) => {
          const cur = t.key === data.tier.key;
          return (
            <div key={t.key} className={`tier-${t.key} relative rounded-3xl p-5 ${cur ? 'ring-4 ring-beni ring-offset-2 ring-offset-washi' : 'opacity-90'}`}>
              {cur && <span className="absolute right-4 top-4 chip bg-beni text-white">You</span>}
              <div className="font-display text-2xl font-bold">{t.name}</div>
              <div className="mt-2 font-display text-4xl font-bold">{t.rate}<span className="ml-1 font-sans text-sm opacity-70">pts / $1</span></div>
              <div className="mt-2 text-sm opacity-80">{t.minSpend === 0 ? 'Starting tier' : `From ${money0(t.minSpend)} lifetime spend`}</div>
              <div className="mt-3 text-sm">A {money0(amount)} meal earns <b>{pts(Math.floor(amount * t.rate))}</b> pts</div>
            </div>
          );
        })}
      </div>
      <div className="card p-5">
        <div className="eyebrow">How your points are calculated</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold">Pre-tax check total</label>
          <input type="range" min="10" max="150" step="5" value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-48 accent-beni" />
          <span className="font-display text-xl font-bold">{money0(amount)}</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-washi p-3"><div className="text-ink-3">Standard hours</div><div className="font-display text-2xl font-bold">{pts(Math.floor(amount * data.tier.rate))}</div><div className="text-xs text-ink-3">{money0(amount)} × {data.tier.rate}</div></div>
          <div className="rounded-xl bg-kin-soft p-3"><div className="text-ink-3">Quiet hour (1.5×)</div><div className="font-display text-2xl font-bold">{pts(Math.floor(amount * data.tier.rate) + Math.floor(Math.floor(amount * data.tier.rate) * 0.5))}</div><div className="text-xs text-ink-3">base + 50% bonus</div></div>
          <div className="rounded-xl bg-beni-soft p-3"><div className="text-ink-3">Calmest hours (2×)</div><div className="font-display text-2xl font-bold">{pts(Math.floor(amount * data.tier.rate) * 2)}</div><div className="text-xs text-ink-3">base + 100% bonus</div></div>
        </div>
        <ul className="mt-4 space-y-1 text-xs text-ink-3">
          <li>• Points are based on the eligible pre-tax subtotal{config.eligibility.includeTip ? '' : ', excluding tips'}, rounded down to the nearest whole point.</li>
          <li>• Minimum qualifying purchase: {money(config.eligibility.minPurchase)}. {config.eligibility.excludedNote}</li>
          <li>• Bonuses don’t stack; the highest multiplier applies (maximum {config.promotions.maxMultiplier}×).</li>
          <li>• Your tier is based on lifetime qualifying spend and never drops when you redeem points.</li>
        </ul>
      </div>
      <div className="card p-5">
        <div className="eyebrow">Quiet Hours schedule</div>
        <p className="mt-1 text-sm text-ink-3">Visit during these windows for bonus points (once per day). The times come from Ema’s real weekly traffic pattern.</p>
        <div className="mt-4"><OffpeakSchedule windows={config.offpeak.windows} activeNow={config.offpeak.activeNow} /></div>
        {config.offpeak.suspended && <div className="mt-3"><Alert kind="warn">Quiet Hours bonuses are temporarily paused.</Alert></div>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- milestones
export function MilestonesPage() {
  const { data, config } = useCustomer();
  const [voucher, setVoucher] = useState(null);
  const ms = data.milestones;
  const history = data.vouchers.filter((v) => v.source === 'milestone');
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Milestone gifts</div>
        <h1 className="font-display text-3xl font-bold">Little rewards along the way</h1>
        <p className="mt-1 text-ink-3">Earn points in your current tier and gifts unlock automatically. They never cost you points.</p>
      </div>
      <MilestoneCard data={data} config={config} />
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div className="eyebrow">{data.tier.name} milestones {ms.repeats ? `· cycle ${ms.cycle + 1} (repeats every ${pts(ms.cycleLen)} pts)` : ''}</div>
        </div>
        <ol className="relative mt-5 space-y-5 border-l-2 border-washi-2 pl-6">
          {ms.list.map((m) => {
            const done = ms.progressPoints >= m.points;
            const r = config.rewards.find((x) => x.id === m.rewardId);
            return (
              <li key={m.key} className="relative">
                <span className={`absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-matcha text-white' : 'bg-washi-2 text-ink-3'}`}>{done ? '✓' : ''}</span>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold">{m.label}</div>
                  <div className="font-display font-bold">{pts(m.points)} pts</div>
                </div>
                <div className="text-sm text-ink-3">{r?.name} {r && `(menu ${money(r.price)})`}</div>
                {!done && <Progress value={ms.progressPoints / m.points} className="mt-2" />}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {config.tiers.filter((t) => t.key !== data.tier.key).map((t) => (
          <div key={t.key} className="card p-4">
            <TierBadge tier={t} />
            <ul className="mt-3 space-y-1 text-sm">
              {(config.milestones[t.key] || []).map((m) => (
                <li key={m.key} className="flex justify-between gap-2"><span>{m.label}</span><span className="font-semibold">{pts(m.points)}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="eyebrow mb-3">Milestone history</div>
        {history.length === 0 ? (
          <div className="text-sm text-ink-3">Your first milestone gift is on its way.</div>
        ) : (
          <ul className="divide-y divide-washi-2">
            {history.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <div className="font-semibold">{v.reward_name}</div>
                  <div className="text-xs text-ink-3">Unlocked {date(v.issued_at)}</div>
                </div>
                {v.status === 'issued' ? <button className="btn-outline px-3 py-1.5" onClick={() => setVoucher(v)}>Show code</button> : <StatusChip s={v.status} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <VoucherModal v={voucher} onClose={() => setVoucher(null)} />
    </div>
  );
}

function StatusChip({ s }) {
  const c = { used: 'bg-washi-2 text-ink-3', issued: 'bg-matcha-soft text-matcha', expired: 'bg-beni-soft text-beni-dark', void: 'bg-washi-2 text-ink-4', posted: 'bg-matcha-soft text-matcha', reversed: 'bg-beni-soft text-beni-dark' }[s] || 'bg-washi-2';
  return <span className={`chip ${c}`}>{s === 'issued' ? 'ready' : s}</span>;
}

// ----------------------------------------------------------------------------- exclusive
export function ExclusivePage() {
  const { data, config } = useCustomer();
  const [voucher, setVoucher] = useState(null);
  const toast = useToast();
  const owner = data.vouchers.filter((v) => v.source === 'owner' || v.source === 'birthday');
  const tierItems = config.rewards.filter((r) => r.category === 'exclusive');
  const link = `${window.location.origin}/join?ref=${data.profile.referralCode}`;
  return (
    <div className="space-y-6">
      <div className="seigaiha overflow-hidden rounded-3xl p-6 text-washi sm:p-8">
        <div className="eyebrow text-kin">Ema Exclusive</div>
        <h1 className="font-display text-3xl font-bold">Owner’s Rewards</h1>
        <p className="mt-2 max-w-lg text-washi/70">Personal thank-yous from the Ema family to guests who make our restaurant special. You can’t buy these with points. They are given by hand.</p>
      </div>
      <div className="card p-5">
        <div className="eyebrow mb-3">Your exclusive rewards</div>
        {owner.length === 0 ? (
          <Empty title="None yet" icon="✦">Keep visiting. Our owner personally recognizes loyal guests with surprise rewards and event invitations.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owner.map((v) => (
              <div key={v.id} className="rounded-2xl border border-kin/40 bg-kin-soft/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{v.reward_name}</div>
                  <StatusChip s={v.status} />
                </div>
                {v.note && <div className="mt-1 text-sm italic text-ink-3">“{v.note}”</div>}
                <div className="mt-2 text-xs text-ink-3">Issued {date(v.issued_at)} · expires {date(v.expires_at)}</div>
                {v.status === 'issued' && <button className="btn-primary mt-3 w-full" onClick={() => setVoucher(v)}>Show code</button>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-5">
        <div className="eyebrow mb-3">Tier-exclusive menu rewards</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tierItems.map((r) => (
            <div key={r.id} className="flex gap-3 rounded-2xl border border-washi-2 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl"><FoodArt category={r.category} imageUrl={r.imageUrl} name={r.name} /></div>
              <div>
                <div className="flex items-center gap-2"><span className="font-semibold">{r.name}</span><TierBadge tier={r.minTier} /></div>
                <div className="text-sm text-ink-3">{pts(r.points)} pts · in the marketplace</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {config.referral.enabled && (
        <div className="card p-5">
          <div className="eyebrow">Invite friends</div>
          <div className="mt-1 font-display text-xl font-bold">Give {config.referral.refereePoints} pts, get {config.referral.referrerPoints} pts</div>
          <p className="mt-1 text-sm text-ink-3">Your friend earns bonus points and you earn yours after their first visit of {money0(config.referral.minPurchase)}+.</p>
          <div className="mt-3 flex gap-2">
            <input readOnly className="input font-mono text-sm" value={link} />
            <button className="btn-primary" onClick={() => { navigator.clipboard?.writeText(link); toast('Invite link copied'); }}>Copy</button>
          </div>
          <div className="mt-2 text-xs text-ink-3">Your code: <b className="font-mono">{data.profile.referralCode}</b> · {data.referrals.length} friend{data.referrals.length === 1 ? '' : 's'} joined</div>
        </div>
      )}
      {config.birthday.enabled && !data.profile.birthday && (
        <Link to="/app/account" className="card block p-4 text-sm hover:border-beni/40">🎂 Add your birthday to receive a birthday treat every year →</Link>
      )}
      <VoucherModal v={voucher} onClose={() => setVoucher(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------------- history
export function HistoryPage() {
  const { data } = useCustomer();
  const [tab, setTab] = useState('purchases');
  const [voucher, setVoucher] = useState(null);
  const kindLabel = { purchase: 'Purchase', offpeak_bonus: 'Off-peak bonus', promo_bonus: 'Promotion bonus', redemption: 'Reward redeemed', reversal: 'Correction', streak: 'Visit streak', referral: 'Referral', adjustment: 'Adjustment', refund: 'Refund', expiration: 'Expired' };
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Activity</div>
        <h1 className="font-display text-3xl font-bold">Purchase history</h1>
      </div>
      <div className="flex gap-2">
        {[['purchases', 'Purchases'], ['points', 'Points ledger'], ['rewards', 'Rewards']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-washi' : 'bg-paper text-ink-3'}`}>{l}</button>
        ))}
      </div>
      {tab === 'purchases' && (
        <div className="card overflow-x-auto">
          {data.transactions.length === 0 ? <div className="p-6"><Empty title="No purchases yet">Show your code at checkout to earn points.</Empty></div> : (
            <table className="table">
              <thead><tr><th>Date</th><th className="text-right">Amount</th><th className="text-right">Base</th><th className="text-right">Off-peak</th><th className="text-right">Promo</th><th className="text-right">Total</th><th /></tr></thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className={t.status === 'reversed' ? 'opacity-50' : ''}>
                    <td className="whitespace-nowrap">{dateTime(t.created_at)}<div className="text-xs text-ink-4">{t.tier_key} · {t.rate} pts/$</div></td>
                    <td className="text-right">{money(t.eligible_amount)}</td>
                    <td className="text-right">{pts(t.base_points)}</td>
                    <td className="text-right">{t.offpeak_bonus ? <span className="text-matcha">+{pts(t.offpeak_bonus)} <span className="text-xs">({t.offpeak_multiplier}×)</span></span> : '—'}</td>
                    <td className="text-right">{t.promo_bonus ? `+${pts(t.promo_bonus)}` : '—'}</td>
                    <td className="text-right font-semibold">{pts(t.total_points)}</td>
                    <td><StatusChip s={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === 'points' && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Detail</th><th className="text-right">Points</th></tr></thead>
            <tbody>
              {data.ledger.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{dateTime(l.created_at)}</td>
                  <td>{kindLabel[l.kind] || l.kind}</td>
                  <td className="text-ink-3">{l.note}</td>
                  <td className={`text-right font-semibold ${l.delta < 0 ? 'text-beni' : 'text-matcha'}`}>{l.delta > 0 ? '+' : ''}{pts(l.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'rewards' && (
        <div className="card overflow-x-auto">
          {data.vouchers.length === 0 ? <div className="p-6"><Empty title="No rewards yet" /></div> : (
            <table className="table">
              <thead><tr><th>Reward</th><th>Source</th><th>Issued</th><th className="text-right">Points</th><th>Status</th></tr></thead>
              <tbody>
                {data.vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold">{v.reward_name}<div className="font-mono text-xs text-ink-4">{v.code}</div></td>
                    <td className="capitalize">{v.source}</td>
                    <td className="whitespace-nowrap">{date(v.issued_at)}</td>
                    <td className="text-right">{v.points_spent ? pts(v.points_spent) : 'Free'}</td>
                    <td>{v.status === 'issued' ? <button className="btn-outline px-2.5 py-1 text-xs" onClick={() => setVoucher(v)}>Show code</button> : <StatusChip s={v.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <VoucherModal v={voucher} onClose={() => setVoucher(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------------- account
export function AccountPage() {
  const { data, config, reload } = useCustomer();
  const { logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const p = data.profile;
  const [f, setF] = useState({ firstName: p.firstName, lastName: p.lastName, phone: p.phone || '', birthday: p.birthday || '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/customer/profile', { method: 'PUT', body: f });
      toast('Profile saved');
      reload();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/account/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      toast('Password updated');
    } catch (e2) {
      setErr(e2.message);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-3xl font-bold">Account</h1>
      <Alert>{err}</Alert>
      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="eyebrow">Profile</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        </div>
        <Field label="Email"><input className="input bg-washi" value={p.email} disabled /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Birthday" hint={p.birthday ? 'Contact us to change' : 'Can be set once'}><input className="input" type="date" disabled={!!p.birthday} value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></Field>
        </div>
        <div className="text-xs text-ink-3">Member ID {p.memberId} · joined {date(p.memberSince)}</div>
        <button className="btn-primary">Save</button>
      </form>
      <form onSubmit={changePw} className="card space-y-4 p-5">
        <div className="eyebrow">Change password</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New"><input className="input" type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        </div>
        <button className="btn-outline">Update password</button>
      </form>
      <div id="terms" className="card p-5">
        <div className="eyebrow mb-2">Program terms</div>
        <p className="text-sm leading-relaxed text-ink-3">{config.terms}</p>
      </div>
      <button className="btn-outline w-full" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
    </div>
  );
}
