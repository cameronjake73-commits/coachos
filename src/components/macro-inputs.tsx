'use client';
import { useState } from 'react';

/** Calories + macro inputs with a live check that the macros add up to the calorie target. */
export function MacroInputs({ initial }: { initial: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; water_l: number | null } }) {
  const [v, setV] = useState({
    calories: initial.calories?.toString() ?? '', protein_g: initial.protein_g?.toString() ?? '',
    carbs_g: initial.carbs_g?.toString() ?? '', fat_g: initial.fat_g?.toString() ?? '',
  });
  const n = (s: string) => (s.trim() === '' ? null : Number(s));
  const p = n(v.protein_g), c = n(v.carbs_g), f = n(v.fat_g), kcal = n(v.calories);
  const fromMacros = p != null && c != null && f != null ? Math.round(p * 4 + c * 4 + f * 9) : null;
  const diff = fromMacros != null && kcal != null ? fromMacros - kcal : null;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  const field = (k: keyof typeof v, label: string, step = '1') => (
    <label className="block"><span className="label">{label}</span>
      <input name={k} type="number" min="0" step={step} inputMode="numeric" value={v[k]} onChange={set(k)} className="input num" /></label>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {field('calories', 'Calories')}
        {field('protein_g', 'Protein (g)')}
        {field('carbs_g', 'Carbs (g)')}
        {field('fat_g', 'Fat (g)')}
        <label className="block"><span className="label">Water (L)</span><input name="water_l" type="number" min="0" step="0.1" inputMode="decimal" defaultValue={initial.water_l ?? ''} className="input num" /></label>
      </div>
      {fromMacros != null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-100/50 px-3 py-2 text-[13px] text-slate-600">
          <span>Macros add up to <strong className="num text-slate-900">{fromMacros} kcal</strong></span>
          {diff != null && Math.abs(diff) > 50 && <span className="text-amber-700">{Math.abs(diff)} kcal {diff > 0 ? 'over' : 'under'} the calorie target</span>}
          {diff != null && Math.abs(diff) <= 50 && <span className="text-emerald-700">Matches the calorie target</span>}
          {kcal == null && <button type="button" className="link" onClick={() => setV((o) => ({ ...o, calories: String(fromMacros) }))}>Use as calorie target</button>}
          {p != null && fromMacros > 0 && <span className="num">P {Math.round((p * 4 / fromMacros) * 100)}% · C {Math.round(((c ?? 0) * 4 / fromMacros) * 100)}% · F {Math.round(((f ?? 0) * 9 / fromMacros) * 100)}%</span>}
        </div>
      )}
    </div>
  );
}
