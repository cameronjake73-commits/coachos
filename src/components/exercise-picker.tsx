'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from './icons';

export type PickerExercise = { id: string; name: string; muscle_group: string | null; equipment: string | null; mine: boolean };

/** Searchable exercise list. Tapping an exercise adds it to the workout straight away (3 × 8-12 by default, editable after). */
export function ExercisePicker({ exercises, hidden, action }: { exercises: PickerExercise[]; hidden: Record<string, string>; action: (fd: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const groups = useMemo(() => [...new Set(exercises.map((e) => e.muscle_group || 'Other'))].sort(), [exercises]);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return exercises.filter((e) => (!group || (e.muscle_group || 'Other') === group) && (!n || e.name.toLowerCase().includes(n) || (e.equipment ?? '').toLowerCase().includes(n)));
  }, [exercises, q, group]);

  const add = (id: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    fd.set('exercise_id', id);
    setAdding(id);
    start(async () => { await action(fd); setAdding(null); setOpen(false); setQ(''); });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:border-brand-500/60 hover:text-slate-900">
        <Icon name="plus" className="h-4 w-4" />Add exercise
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-slate-300 bg-[#0c0e18] p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className="input pl-9" />
        </div>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="scroll-x mt-2 gap-1.5 pb-1">
        {[null, ...groups].map((g) => (
          <button key={g ?? 'all'} type="button" onClick={() => setGroup(g)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${group === g ? 'border-brand-500/60 bg-brand-50 text-brand-100' : 'border-slate-200 text-slate-600 hover:text-slate-900'}`}>{g ?? 'All'}</button>
        ))}
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
        {list.length === 0 && <li className="py-6 text-center text-[13px] text-slate-500">No exercises found. <Link href="/coach/exercises" className="link">Add your own</Link></li>}
        {list.map((e) => (
          <li key={e.id}>
            <button type="button" disabled={pending} onClick={() => add(e.id)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition hover:bg-slate-100 disabled:opacity-60">
              <span className="min-w-0 flex-1"><span className="block truncate text-slate-900">{e.name}</span><span className="block truncate text-xs text-slate-500">{[e.muscle_group, e.equipment].filter(Boolean).join(' · ')}{e.mine ? ' · yours' : ''}</span></span>
              <span className="text-xs font-medium text-brand-700">{adding === e.id ? 'Adding…' : 'Add'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
