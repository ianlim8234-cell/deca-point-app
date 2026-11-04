// Minimal ink-style illustrations for reward cards. They are used when no photo is set.
// The owner can add a real food photo to any reward in Owner → Rewards (Image URL).
const PALETTE = {
  beverages: ['#e3e8d6', '#5f6f4a'],
  appetizers: ['#efe2c4', '#a8823f'],
  sushi: ['#f3dcd6', '#b23a2b'],
  entrees: ['#e6dccb', '#6b4f1d'],
  specialty: ['#dde3ec', '#2f3e55'],
  exclusive: ['#1d1917', '#c9a35b'],
};

function Glyph({ category, color }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (category) {
    case 'beverages':
      return (
        <g {...s}>
          <path d="M34 30h32l-4 40a6 6 0 0 1-6 5H44a6 6 0 0 1-6-5z" />
          <path d="M66 38h5a7 7 0 0 1 0 14h-6" />
          <path d="M44 22c0-4 4-4 4-8M54 22c0-4 4-4 4-8" />
        </g>
      );
    case 'appetizers':
      return (
        <g {...s}>
          <ellipse cx="50" cy="62" rx="30" ry="9" />
          <path d="M28 58c4-12 14-18 22-18s18 6 22 18" />
          <path d="M40 46c2 3 4 4 6 4M54 44c2 3 4 4 6 4" />
          <path d="M24 30l40 10M26 24l40 12" />
        </g>
      );
    case 'sushi':
      return (
        <g {...s}>
          <rect x="24" y="48" width="52" height="16" rx="8" />
          <path d="M26 48c6-12 42-12 48 0" />
          <path d="M40 40l4 8M52 38l2 10M62 40l-2 8" />
        </g>
      );
    case 'entrees':
      return (
        <g {...s}>
          <path d="M22 46h56a28 22 0 0 1-56 0z" />
          <path d="M34 46c2-8 8-6 10-12M50 46c2-8 8-6 10-12" />
          <path d="M60 18L42 44M68 20L50 44" />
        </g>
      );
    case 'exclusive':
      return (
        <g {...s}>
          <path d="M26 64h48M30 64l-4-28 14 12 10-18 10 18 14-12-4 28" />
          <circle cx="50" cy="26" r="2.5" />
        </g>
      );
    default:
      return (
        <g {...s}>
          <path d="M20 58h60" />
          <path d="M28 58c0-10 10-16 22-16s22 6 22 16" />
          <path d="M34 42c4-6 10-8 16-8M62 30l10-10" />
        </g>
      );
  }
}

export default function FoodArt({ category, imageUrl, name, className = '' }) {
  const [bg, fg] = PALETTE[category] || PALETTE.specialty;
  if (imageUrl) return <img src={imageUrl} alt={name} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`} style={{ background: bg }}>
      <svg viewBox="0 0 100 90" className="h-[70%] w-[70%]" aria-hidden>
        <circle cx="72" cy="22" r="14" fill={fg} opacity=".14" />
        <Glyph category={category} color={fg} />
      </svg>
    </div>
  );
}
