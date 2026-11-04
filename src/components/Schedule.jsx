import { fmtTime, localParts } from '../../shared/engine.js';
import { DAY_NAMES } from '../lib/format.js';

/** Weekly list of off-peak bonus windows, ordered starting from today. */
export function OffpeakSchedule({ windows = [], activeNow, compact = false }) {
  const today = localParts(new Date()).day; // restaurant-local day
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (today + i) % 7);
  return (
    <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {order.map((d) => {
        const ws = windows.filter((w) => Number(w.day) === d).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <div key={d} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${d === today ? 'border-beni/30 bg-beni-soft/40' : 'border-washi-2 bg-paper'}`}>
            <div className="w-20 shrink-0 pt-0.5 text-sm font-semibold">
              {DAY_NAMES[d].slice(0, 3)}
              {d === today && <span className="ml-1 text-[10px] font-bold uppercase text-beni">Today</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ws.length === 0 && <span className="text-sm text-ink-4">Standard points all day</span>}
              {ws.map((w) => {
                const live = activeNow && activeNow.id === w.id;
                return (
                  <span key={w.id} className={`chip ${w.multiplier >= 2 ? 'bg-beni text-white' : 'bg-kin-soft text-[#6b4f1d]'} ${live ? 'ring-2 ring-matcha ring-offset-1' : ''}`}>
                    {fmtTime(w.start)}–{fmtTime(w.end)} · {w.multiplier}×{live && ' · NOW'}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OffpeakNowBanner({ config }) {
  if (!config) return null;
  const now = config.offpeak?.activeNow;
  if (config.offpeak?.suspended || !config.offpeak?.enabled) return null;
  if (!now) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-matcha px-4 py-3 text-white shadow-card">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>
      <div className="text-sm">
        <b>Quiet Hours Bonus is live:</b> {now.multiplier}× points until {fmtTime(now.end)}
      </div>
    </div>
  );
}
