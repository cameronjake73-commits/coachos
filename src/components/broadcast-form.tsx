'use client';
import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Avatar } from './avatar';

export type Audience = 'active' | 'attention' | 'missed' | 'pick';
type C = { id: string; full_name: string; groups: Audience[] };

function Send({ n }: { n: number }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || n === 0} className="btn-primary w-full sm:w-auto">{pending ? 'Sending…' : `Send to ${n} client${n === 1 ? '' : 's'}`}</button>;
}

const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: 'active', label: 'All active clients', hint: 'Everyone currently being coached' },
  { key: 'attention', label: 'Needs attention', hint: 'At risk, missed check-in or payment overdue' },
  { key: 'missed', label: 'Missed this week’s check-in', hint: 'A friendly nudge' },
  { key: 'pick', label: 'Choose clients', hint: 'Pick exactly who gets it' },
];

export function BroadcastForm({ action, clients, coachFirst, initialAudience = 'active' }: { action: (fd: FormData) => void | Promise<void>; clients: C[]; coachFirst: string; initialAudience?: Audience }) {
  const [aud, setAud] = useState<Audience>(initialAudience);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [body, setBody] = useState('');
  const recipients = useMemo(() => (aud === 'pick' ? clients.filter((c) => picked.has(c.id)) : clients.filter((c) => c.groups.includes(aud))), [aud, picked, clients]);
  const sample = recipients[0]?.full_name.split(' ')[0] ?? 'Jane';
  const preview = body.replace(/\{first_name\}/gi, sample);
  const count = (a: Audience) => clients.filter((c) => c.groups.includes(a)).length;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="audience" value={aud} />
      {aud === 'pick' && [...picked].map((id) => <input key={id} type="hidden" name="client_id" value={id} />)}

      <fieldset>
        <legend className="label">Who should get it?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <label key={a.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${aud === a.key ? 'border-brand-500/60 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="aud_ui" checked={aud === a.key} onChange={() => setAud(a.key)} className="mt-0.5" />
              <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{a.label}{a.key !== 'pick' && <span className="num ml-1.5 text-slate-500">{count(a.key)}</span>}</span><span className="block text-xs text-slate-500">{a.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {aud === 'pick' && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 p-1">
          {clients.map((c) => (
            <label key={c.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-100">
              <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
              <Avatar name={c.full_name} size={26} /><span className="text-sm">{c.full_name}</span>
            </label>
          ))}
        </div>
      )}

      <label className="block">
        <span className="label">Message</span>
        <textarea name="body" required rows={6} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} className="input"
          placeholder={`Hey {first_name}, quick reminder that check-ins are due Sunday. Even a rough one helps me coach you better this week!\n\n- ${coachFirst}`} />
        <span className="hint block">Type <button type="button" className="link" onClick={() => setBody((b) => `${b}{first_name}`)}>{'{first_name}'}</button> and each client sees their own name. Each person gets it as a private message.</span>
      </label>

      {body.trim() && recipients.length > 0 && (
        <div>
          <div className="eyebrow mb-1.5">Preview for {sample}</div>
          <div className="max-w-md whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">{preview}</div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-slate-500">{recipients.length ? `${recipients.slice(0, 4).map((c) => c.full_name.split(' ')[0]).join(', ')}${recipients.length > 4 ? ` and ${recipients.length - 4} more` : ''}` : 'No one selected yet'}</p>
        <Send n={recipients.length} />
      </div>
    </form>
  );
}
