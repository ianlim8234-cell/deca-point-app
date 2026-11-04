export const money = (n, d = 2) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const money0 = (n) => money(n, 0);
export const pts = (n) => Number(n || 0).toLocaleString('en-US');
export const pct = (n, d = 1) => `${(Number(n || 0) * 100).toFixed(d)}%`;
export const date = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const dateShort = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
export const dateTime = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const ago = (s) => {
  if (!s) return '';
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return dateShort(s);
};
// Compact axis label: $1.5k, $12k, −$3k
export const kfmt = (v) => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) < 10000 && v % 1000 !== 0 ? 1 : 0)}k`;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const hour12 = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
