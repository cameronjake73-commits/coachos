import { requireClient } from '@/lib/auth';
import { sendClientMessage } from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { AutoRefresh } from '@/components/auto-refresh';

export default async function ClientMessages() {
  const { supabase, client } = await requireClient();
  const { data: msgs } = await supabase.from('messages').select('*').eq('client_id', client.id).order('created_at').limit(200);
  await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', client.id).eq('sender', 'coach').is('read_at', null);
  return (
    <div className="space-y-4">
      <AutoRefresh seconds={15} />
      <h1>Your coach</h1>
      <div className="space-y-2">
        {!msgs?.length ? <p className="card text-sm text-slate-500">Say hi to your coach. Messages appear here.</p> : msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.sender === 'client' ? 'bg-brand-600 text-white' : 'bg-surface shadow-sm'}`}>
              {m.body}
              <div className={`mt-1 text-[10px] ${m.sender === 'client' ? 'text-brand-100' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
            </div>
          </div>
        ))}
      </div>
      <form action={sendClientMessage} className="sticky bottom-20 flex gap-2 rounded-xl bg-slate-50 py-2">
        <textarea name="body" required rows={1} className="input" placeholder="Message your coach…" />
        <SubmitButton pendingText="…">Send</SubmitButton>
      </form>
    </div>
  );
}
