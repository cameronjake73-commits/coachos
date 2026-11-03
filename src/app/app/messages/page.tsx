import { requireClient } from '@/lib/auth';
import { sendClientMessage } from '../actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { Conversation } from '@/components/conversation';
import { Avatar } from '@/components/avatar';

export default async function ClientMessages() {
  const { supabase, client } = await requireClient();
  const [{ data: msgs }, { data: coach }] = await Promise.all([
    supabase.from('messages').select('id, sender, body, created_at, read_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('coaches').select('business_name').eq('id', client.coach_id).single(),
  ]);
  await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', client.id).eq('sender', 'coach').is('read_at', null);
  const coachName = coach?.business_name || 'Your coach';
  return (
    <div className="space-y-3">
      <AutoRefresh seconds={15} />
      <header className="flex items-center gap-3"><Avatar name={coachName} size={36} /><h1>{coachName}</h1></header>
      <div className="card">
        <Conversation tall messages={(msgs ?? []).reverse()} me="client" action={sendClientMessage} hidden={{}}
          placeholder="Message your coach…" emptyText="Say hi to your coach. Questions, wins, anything. They’ll reply here." />
      </div>
    </div>
  );
}
