const PALETTE = [
  ['#7c5cff', '#4f2fd8'], ['#22c55e', '#15803d'], ['#f97316', '#c2410c'], ['#3b82f6', '#1d4ed8'],
  ['#ec4899', '#be185d'], ['#14b8a6', '#0f766e'], ['#eab308', '#a16207'], ['#a855f7', '#7e22ce'],
];

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {initials(name)}
    </span>
  );
}
