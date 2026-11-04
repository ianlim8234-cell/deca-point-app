import { POPULAR_TIMES, classify, THRESHOLDS } from '../../shared/popularTimes.js';
import { DAY_SHORT, hour12 } from '../lib/format.js';

export const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
export const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

const CLS_COLOR = { 'very-slow': '#5f6f4a', slow: '#a3b38a', moderate: '#efe2c4', peak: '#b23a2b', closed: '#f3f1ee' };

function inWindow(windows, d, h) {
  return windows.find((w) => !w.disabled && Number(w.day) === d && Number(w.start.slice(0, 2)) <= h && Number(w.end.slice(0, 2)) > h);
}

export function BaselineHeatmap({ windows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {HOURS.map((h) => <th key={h} className="font-semibold text-ink-3">{hour12(h)}</th>)}
          </tr>
        </thead>
        <tbody>
          {ORDER.map((d) => (
            <tr key={d}>
              <td className="pr-2 font-semibold">{DAY_SHORT[d]}</td>
              {HOURS.map((h) => {
                const v = POPULAR_TIMES[d][h];
                const c = classify(v);
                const w = windows && v != null && inWindow(windows, d, h);
                return (
                  <td key={h} title={v == null ? 'Closed' : `${DAY_SHORT[d]} ${hour12(h)}: ${v}/100${w ? ` · bonus ${w.multiplier}×` : ''}`}
                    className={`h-9 min-w-[2.2rem] rounded-md text-center font-semibold ${c === 'peak' ? 'text-white' : c === 'very-slow' ? 'text-white' : 'text-ink'} ${w ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                    style={{ background: CLS_COLOR[c] }}>
                    {v ?? ''}
                    {w && <div className="text-[9px] leading-none">{w.multiplier}×</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-3">
        <Legend c={CLS_COLOR['very-slow']} l={`Very slow ≤${THRESHOLDS.verySlow}`} />
        <Legend c={CLS_COLOR.slow} l={`Slow ≤${THRESHOLDS.slow}`} />
        <Legend c={CLS_COLOR.moderate} l="Moderate" />
        <Legend c={CLS_COLOR.peak} l={`Peak ≥${THRESHOLDS.peak}`} />
        {windows && <span className="flex items-center gap-1"><span className="h-3 w-3 rounded ring-2 ring-ink" /> Bonus window</span>}
      </div>
    </div>
  );
}

function Legend({ c, l }) {
  return <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: c }} />{l}</span>;
}

