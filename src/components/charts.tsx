/** Dependency-free SVG charts, server-rendered. */

type LineProps = { labels: string[]; current: (number | null)[]; previous?: (number | null)[]; max?: number; min?: number; unit?: string; height?: number; width?: number; empty?: string };

function LineSvg({ labels, current, previous, max = 100, min = 0, unit = '%', height = 220, width = 640, empty = 'No check-in data yet', compact = false }: LineProps & { compact?: boolean }) {
  const W = width, H = height, L = compact ? 42 : 44, R = compact ? 12 : 20, T = 26, B = 30;
  const fs = compact ? 11 : 12;
  const x = (i: number) => L + (labels.length === 1 ? (W - L - R) / 2 : (i / (labels.length - 1)) * (W - L - R));
  const span = max - min || 1;
  const y = (v: number) => T + (1 - (Math.min(Math.max(v, min), max) - min) / span) * (H - T - B);
  const fmt = (v: number) => (span < 10 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v)));
  const path = (vals: (number | null)[]) => vals.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' ');
  const pts = current.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  const last = pts[pts.length - 1];
  const area = pts.length > 1 ? `${path(current)} L${x(pts[pts.length - 1].i)},${H - B} L${x(pts[0].i)},${H - B} Z` : '';
  const every = Math.ceil(labels.length / (compact ? 6 : 12));
  const gid = `lc-area-${compact ? 'm' : 'd'}-${W}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity="0.25" /><stop offset="1" stopColor="#7c5cff" stopOpacity="0" /></linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(min + span * f)} y2={y(min + span * f)} stroke="#1c1f30" strokeWidth="1" />
          <text x={L - 8} y={y(min + span * f) + 4} textAnchor="end" fontSize={fs} fill="#5f6583">{fmt(min + span * f)}{unit}</text>
        </g>
      ))}
      {labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? <text key={l + i} x={x(i)} y={H - 8} textAnchor={labels.length > 1 && i === 0 ? 'start' : labels.length > 1 && i === labels.length - 1 ? 'end' : 'middle'} dx={labels.length > 1 && i === 0 ? -4 : labels.length > 1 && i === labels.length - 1 ? 4 : 0} fontSize={fs} fill="#878da9">{l}</text> : null)}
      {previous && <path d={path(previous)} fill="none" stroke="#5f6583" strokeWidth="1.75" strokeDasharray="5 6" />}
      {area && <path d={area} fill={`url(#${gid})`} />}
      <path d={path(current)} fill="none" stroke="#8b6cff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => <circle key={`c${p.i}`} cx={x(p.i)} cy={y(p.v)} r={compact ? 3.5 : 4} fill="#10121d" stroke="#9a83ff" strokeWidth="2" />)}
      {last && (
        <g>
           <rect x={x(last.i) - 26} y={y(last.v) - 30} width="52" height="20" rx="6" fill="#ddd5ff" />
          <text x={x(last.i)} y={y(last.v) - 16} textAnchor="middle" fontSize="12" fontWeight="600" fill="#2a1a73">{fmt(last.v)}{unit}</text>
        </g>
      )}
      {!pts.length && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#5f6583">{empty}</text>}
    </svg>
  );
}

/** Responsive line chart: a compact layout on phones (readable labels) and a wide one from md up. */
export function LineChart(props: LineProps) {
  return (
    <>
      <div className="md:hidden"><LineSvg {...props} width={360} height={200} compact /></div>
      <div className="hidden md:block"><LineSvg {...props} /></div>
    </>
  );
}

export function BarChart({ values, labels, height = 120, showLabels = false, format }: { values: number[]; labels?: string[]; height?: number; showLabels?: boolean; format?: (v: number) => string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5 md:gap-2" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={format ? format(v) : String(v)}>
            <div className="w-full rounded-t-[5px] bg-gradient-to-b from-brand-400 to-brand-600 transition group-hover:from-brand-300"
              style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: 0.4 + 0.6 * ((i + 1) / values.length) }} />
          </div>
        ))}
      </div>
      {showLabels && labels && (
        <div className="mt-2 flex gap-1.5 md:gap-2">{labels.map((l, i) => <div key={i} className="flex-1 truncate text-center text-2xs text-slate-500">{l}</div>)}</div>
      )}
    </div>
  );
}

export function Donut({ value, size = 64, color = '#22c55e', track = 'rgba(255,255,255,0.07)' }: { value: number; size?: number; color?: string; track?: string }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke={track} strokeWidth="7" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(Math.min(value, 100) / 100) * c} ${c}`} transform="rotate(-90 28 28)" />
    </svg>
  );
}
