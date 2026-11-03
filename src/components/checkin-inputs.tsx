'use client';
import { useEffect, useState } from 'react';

/** Range slider that shows its current value. */
export function RangeField({ name, label, min = 0, max = 100, step = 10, defaultValue, suffix = '%', low, high }: {
  name: string; label: string; min?: number; max?: number; step?: number; defaultValue: number; suffix?: string; low?: string; high?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between"><span className="label mb-0">{label}</span><span className="num text-lg font-semibold text-slate-900">{v}{suffix}</span></span>
      <input name={name} type="range" min={min} max={max} step={step} value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-2 h-8 w-full cursor-pointer accent-brand-600" />
      {(low || high) && <span className="flex justify-between text-2xs text-slate-500"><span>{low}</span><span>{high}</span></span>}
    </label>
  );
}

/** 1-10 tap scale. */
export function ScaleField({ name, label, low, high }: { name: string; label: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} className="peer sr-only" />
            <span className="num flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm transition peer-checked:border-brand-500 peer-checked:bg-brand-600 peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 md:h-9">{v}</span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-2xs text-slate-500"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  );
}

/** One photo slot (front / side / back) with a preview. */
export function PhotoSlot({ name, label }: { name: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <label className="group block cursor-pointer">
      <span className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100/40 transition group-hover:border-brand-500/60">
        {url ? <img src={url} alt={`${label} preview`} className="h-full w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-1 text-slate-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
            <span className="text-xs">Add</span>
          </span>
        )}
        <input type="file" name={name} accept="image/*" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0];
          setErr(null);
          if (!f) { setUrl(null); return; }
          if (f.size > 8 * 1024 * 1024) { setErr('Max 8MB'); e.target.value = ''; return; }
          setUrl(URL.createObjectURL(f));
        }} />
      </span>
      <span className="mt-1 block text-center text-xs text-slate-600">{err ? <span className="text-red-700">{err}</span> : label}</span>
    </label>
  );
}
