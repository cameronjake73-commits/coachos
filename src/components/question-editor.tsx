'use client';
import { useState } from 'react';
import { Icon } from './icons';
import type { CheckinQuestion, QuestionType } from '@/lib/types';

const TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Written answer' },
  { value: 'scale', label: 'Scale 1–10' },
  { value: 'yesno', label: 'Yes / No' },
];

/** Edits the coach's custom check-in questions. Serialised into a hidden input for the settings form. */
export function QuestionEditor({ initial }: { initial: CheckinQuestion[] }) {
  const [qs, setQs] = useState<CheckinQuestion[]>(initial.map((q) => ({ ...q, type: q.type ?? 'text' })));
  const update = (i: number, patch: Partial<CheckinQuestion>) => setQs((xs) => xs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) => setQs((xs) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const add = () => setQs((xs) => [...xs, { id: `q${Date.now().toString(36)}`, label: '', type: 'text' }]);

  return (
    <div className="space-y-2">
      <input type="hidden" name="checkin_questions_json" value={JSON.stringify(qs.filter((q) => q.label.trim()).map((q) => ({ ...q, label: q.label.trim().slice(0, 200) })))} />
      {qs.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[13px] text-slate-500">No extra questions. Clients answer the standard check-in only.</p>}
      {qs.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/40 p-2.5 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor={`ql-${q.id}`}>Question {i + 1}</label>
          <input id={`ql-${q.id}`} value={q.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={200} placeholder="e.g. How was your digestion this week?" className="input flex-1" />
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor={`qt-${q.id}`}>Answer type</label>
            <select id={`qt-${q.id}`} value={q.type} onChange={(e) => update(i, { type: e.target.value as QuestionType })} className="input w-auto flex-1 sm:flex-none">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="icon-btn disabled:opacity-30" aria-label="Move up"><Icon name="chevronUp" className="h-4 w-4" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === qs.length - 1} className="icon-btn disabled:opacity-30" aria-label="Move down"><Icon name="chevronDown" className="h-4 w-4" /></button>
            <button type="button" onClick={() => setQs((xs) => xs.filter((_, k) => k !== i))} className="icon-btn hover:text-red-700" aria-label="Remove question"><Icon name="trash" className="h-4 w-4" /></button>
          </div>
        </div>
      ))}
      {qs.length < 10 && <button type="button" onClick={add} className="btn-secondary btn-sm"><Icon name="plus" className="h-4 w-4" />Add question</button>}
    </div>
  );
}
