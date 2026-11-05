'use client';
import { useState } from 'react';
import { Icon } from './icons';

type QR = { key: string; title: string; body: string };

export const SUGGESTED_REPLIES = [
  { title: 'Got it', body: "Got it {name}, thanks for letting me know. I'll factor that into your plan." },
  { title: 'Missed session', body: "No stress about missing a session, {name}. Don't try to make it up, just pick things back up with your next workout." },
  { title: 'Check-in nudge', body: "Hey {name}, quick nudge: your check-in is due. It takes about 3 minutes and it's how I keep your plan moving." },
  { title: 'Outside my remit', body: "I really appreciate you telling me, {name}. This is outside what I can help with as your coach, so please speak to your GP, who can point you to the right support. I'm still here for your training and nutrition, and we'll keep this week simple." },
  { title: "I'll reply properly", body: "Thanks {name}, I've seen this. I'll give you a proper answer during my working hours." },
];

/** Edits the coach's saved replies. Serialised into a hidden input for the settings form. */
export function QuickReplyEditor({ initial }: { initial: { title: string; body: string }[] }) {
  const [items, setItems] = useState<QR[]>(initial.map((q, i) => ({ key: `i${i}`, ...q })));
  const update = (i: number, patch: Partial<QR>) => setItems((xs) => xs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const add = (q = { title: '', body: '' }) => setItems((xs) => [...xs, { key: `n${Date.now().toString(36)}${xs.length}`, ...q }]);
  const missing = SUGGESTED_REPLIES.filter((s) => !items.some((q) => q.title === s.title));

  return (
    <div className="space-y-2">
      <input type="hidden" name="quick_replies_json" value={JSON.stringify(items.filter((q) => q.body.trim()).map(({ title, body }) => ({ title: (title.trim() || body.trim()).slice(0, 40), body: body.trim().slice(0, 2000) })))} />
      {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[13px] text-slate-500">No saved replies yet. Add your own or start with the suggestions below.</p>}
      {items.map((q, i) => (
        <div key={q.key} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-2.5">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`qrt-${q.key}`}>Reply name</label>
            <input id={`qrt-${q.key}`} value={q.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={40} placeholder="Short name, e.g. Missed session" className="input flex-1" />
            <button type="button" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} className="icon-btn hover:text-red-700" aria-label="Remove saved reply"><Icon name="trash" className="h-4 w-4" /></button>
          </div>
          <label className="sr-only" htmlFor={`qrb-${q.key}`}>Reply text</label>
          <textarea id={`qrb-${q.key}`} value={q.body} onChange={(e) => update(i, { body: e.target.value })} rows={3} maxLength={2000} placeholder="The message. Use {name} for their first name." className="input" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {items.length < 12 && <button type="button" onClick={() => add()} className="btn-secondary btn-sm"><Icon name="plus" className="h-4 w-4" />Add saved reply</button>}
        {missing.length > 0 && items.length < 12 && missing.map((s) => (
          <button key={s.title} type="button" onClick={() => add(s)} className="btn-ghost btn-sm border border-dashed border-slate-300"><Icon name="plus" className="h-3.5 w-3.5" />{s.title}</button>
        ))}
      </div>
    </div>
  );
}
