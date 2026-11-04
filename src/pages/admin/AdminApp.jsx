import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { api } from '../../lib/api.js';
import { useAuth, hasRole } from '../../lib/auth.jsx';
import { Login } from '../Auth.jsx';
import { Logo, PageLoader, Stat, DemoBanner, Alert, Toggle } from '../../components/ui.jsx';
import { money, money0, pts, pct, kfmt } from '../../lib/format.js';
import Customers, { CustomerDetail } from './Customers.jsx';
import OffPeak from './OffPeak.jsx';
import Finance, { Simulator } from './Finance.jsx';
import Rewards, { Promotions, OwnerRewards } from './Rewards.jsx';
import Settings, { Staff, ActivityLog } from './Settings.jsx';

export const TIER_COLORS = { silver: '#9aa3ad', gold: '#c9a35b', platinum: '#2f3e55' };
export const CHART = { ink: '#1d1917', beni: '#b23a2b', kin: '#a8823f', matcha: '#5f6f4a', ai: '#2f3e55', grid: '#ece3d3' };

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/offpeak', label: 'Off-Peak' },
  { to: '/admin/finance', label: 'Financials' },
  { to: '/admin/simulator', label: 'Profit Simulator' },
  { to: '/admin/rewards', label: 'Rewards & Pricing' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/owner-rewards', label: 'Owner’s Rewards' },
  { to: '/admin/settings', label: 'Program Settings', owner: true },
  { to: '/admin/staff', label: 'Staff Accounts', owner: true },
  { to: '/admin/activity', label: 'Audit Log' },
];

export default function AdminApp() {
  const { user } = useAuth();
  if (user === undefined) return <PageLoader />;
  if (!user || !hasRole(user, 'manager')) {
    if (user && hasRole(user, 'employee')) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="card max-w-sm p-6 text-center">
            <div className="font-display text-xl font-bold">Managers only</div>
            <p className="mt-2 text-sm text-ink-3">Employee accounts can record purchases and verify rewards in the staff portal.</p>
            <Link to="/staff" className="btn-primary mt-4">Go to staff portal</Link>
          </div>
        </div>
      );
    }
    return <Login portal="staff" next="admin" />;
  }
  return <AdminShell />;
}

function AdminShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [includeDemo, setIncludeDemo] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState(false);
  const isOwner = hasRole(user, 'owner');

  const reload = useCallback(async () => {
    try {
      setData(await api(`/admin/analytics?demo=${includeDemo ? 1 : 0}`));
    } catch (e) {
      setErr(e.message);
    }
  }, [includeDemo]);
  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <AdminCtx.Provider value={{ data, reload, includeDemo, setIncludeDemo, isOwner, user }}>
      <div className="min-h-screen bg-[#f3f1ee] lg:grid lg:grid-cols-[240px_1fr]">
        <aside className={`seigaiha fixed inset-y-0 left-0 z-40 w-64 transform p-4 text-washi transition lg:static lg:w-auto lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <Logo light size="sm" />
            <button className="text-washi/60 lg:hidden" onClick={() => setMenu(false)}>✕</button>
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-kin">Management</div>
          <nav className="mt-6 space-y-0.5">
            {NAV.filter((n) => !n.owner || isOwner).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenu(false)} className={({ isActive }) => `block rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-washi text-ink' : 'text-washi/70 hover:bg-white/5 hover:text-washi'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 space-y-1 border-t border-white/10 pt-4 text-sm">
            <Link to="/staff" className="block rounded-xl px-3 py-2 text-washi/70 hover:bg-white/5">Staff scanner ↗</Link>
            <Link to="/poster" className="block rounded-xl px-3 py-2 text-washi/70 hover:bg-white/5">Print desk QR poster ↗</Link>
            <Link to="/program" className="block rounded-xl px-3 py-2 text-washi/70 hover:bg-white/5">Business case page ↗</Link>
          </div>
          <div className="absolute inset-x-4 bottom-4 rounded-xl bg-white/5 p-3 text-xs">
            <div className="font-semibold">{user.firstName} {user.lastName}</div>
            <div className="capitalize text-washi/50">{user.role}</div>
            <button className="mt-2 font-semibold text-kin hover:underline" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
          </div>
        </aside>
        {menu && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMenu(false)} />}
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-washi-2 bg-[#f3f1ee]/90 px-4 py-3 backdrop-blur sm:px-6">
            <button className="btn-outline px-3 lg:hidden" onClick={() => setMenu(true)}>☰</button>
            <div className="hidden text-sm text-ink-3 lg:block">Ema Japanese Cuisine · Loyalty Program Management</div>
            {data?.hasDemo && <Toggle checked={includeDemo} onChange={setIncludeDemo} label="Include demo data" />}
          </header>
          <main className="space-y-5 p-4 sm:p-6">
            {err && <Alert>{err}</Alert>}
            {data?.hasDemo && includeDemo && <DemoBanner>Charts include hypothetical demonstration members and transactions (labeled “demo”). They are not actual restaurant results. Turn the toggle off to see real data only.</DemoBanner>}
            <Routes>
              <Route index element={<Overview />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="offpeak" element={<OffPeak />} />
              <Route path="finance" element={<Finance />} />
              <Route path="simulator" element={<Simulator />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="owner-rewards" element={<OwnerRewards />} />
              {isOwner && <Route path="settings" element={<Settings />} />}
              {isOwner && <Route path="staff" element={<Staff />} />}
              <Route path="activity" element={<ActivityLog />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

export function PageHead({ eyebrow, title, children, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {children && <p className="mt-1 max-w-3xl text-sm text-ink-3">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, sub, children, className = '', actions }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <div className="font-semibold">{title}</div>}
            {sub && <div className="text-xs text-ink-3">{sub}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function Overview() {
  const { data } = useAdmin();
  if (!data) return <PageLoader />;
  const c = data.customers, f = data.finance;
  const tierPie = data.tiers.map((t) => ({ name: t.name, value: t.members, key: t.key }));
  const segs = Object.entries(data.segments).map(([k, v]) => ({ name: k, value: v }));
  return (
    <>
      <PageHead eyebrow="Owner dashboard" title="Program overview">How Ema Rewards is performing: membership, sales, rewards cost and quiet-hour traffic.</PageHead>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered members" value={pts(c.total)} sub={`${c.new30} new in the last 30 days`} />
        <Stat label="Active members (60d)" value={pts(c.active)} sub={`${pct(c.repeatPct, 0)} repeat-visit rate`} />
        <Stat label="Member sales" value={money0(f.totalSales)} sub={`${pts(f.visits)} visits · avg check ${money(c.avgCheck)}`} />
        <Stat label="Reward cost rate" value={pct(f.rewardCostRate)} sub={`of member sales (accrued); target ${pct(0.02)}`} accent={f.rewardCostRate > 0.03 ? 'text-beni' : 'text-matcha'} />
        <Stat label="Contribution after rewards" value={money0(f.contributionAfterRewards)} sub="estimate, using the contribution-margin assumption" />
        <Stat label="Outstanding point liability" value={money0(f.liability)} sub={`${pts(f.outstanding)} pts × ${money(f.costPerPoint, 4)}/pt × (1 − breakage)`} />
        <Stat label="Off-peak member sales" value={money0(f.offpeakSales)} sub={`${pct(f.totalSales ? f.offpeakSales / f.totalSales : 0)} of member sales · ${pct(data.offpeak.participation, 0)} of members joined in`} />
        <Stat label="Projected customer value" value={money0(c.projectedCLV)} sub={`${c.visitsPerMonth.toFixed(2)} visits/mo · ${c.clvAssumptionYears}-yr contribution`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Monthly member sales" sub="Eligible pre-tax sales from loyalty members" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.monthly}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={kfmt} width={44} />
                <Tooltip formatter={(v) => money0(v)} />
                <Legend />
                <Area type="monotone" dataKey="sales" name="All member sales" stroke={CHART.ink} fill={CHART.ink} fillOpacity={0.08} />
                <Area type="monotone" dataKey="offpeakSales" name="Off-peak bonus sales" stroke={CHART.matcha} fill={CHART.matcha} fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Membership tiers">
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={tierPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {tierPie.map((t) => <Cell key={t.key} fill={TIER_COLORS[t.key]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            {data.tiers.map((t) => (
              <div key={t.key} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[t.key] }} />{t.name} ({t.rate} pts/$)</span><b>{t.members}</b></div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Automated recommendations" sub="Rule-based alerts generated from live program data">
          <ul className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className={`rounded-xl px-3 py-2 text-sm ${r.kind === 'ok' ? 'bg-matcha-soft text-matcha' : 'bg-kin-soft text-[#6b4f1d]'}`}>{r.text}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Customer segments" sub="Recency, frequency and value segmentation">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={segs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART.beni} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Redemption budget this month" sub="Marketplace redemptions pause automatically when the budget is reached">
        <div className="flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-washi-2">
            <div className={`h-3 rounded-full ${f.monthRedemptionCost / f.monthlyBudget > 0.8 ? 'bg-beni' : 'bg-matcha'}`} style={{ width: `${Math.min(100, (f.monthRedemptionCost / f.monthlyBudget) * 100)}%` }} />
          </div>
          <div className="text-sm font-semibold">{money0(f.monthRedemptionCost)} / {money0(f.monthlyBudget)}</div>
        </div>
      </Panel>
    </>
  );
}
