import { requireClient } from '@/lib/auth';
import { sendClientMessage } from '../actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { Conversation } from '@/components/conversation';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { hoursFrom, hoursSummary, isOpen, nextOpenText, replyPromise } from '@/lib/hours';

export default async function ClientMessages() {
  const { supabase, client } = await requireClient();
  const [{ data: msgs }, { data: coach }] = await Promise.all([
    supabase.from('messages').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('coaches').select('*').eq('id', client.coach_id).single(),
    supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', client.id).eq('sender', 'coach').is('read_at', null),
  ]);
  const coachName = coach?.business_name || 'Your coach';
  const hours = hoursFrom(coach ?? {});
  const open = isOpen(hours);
  const banner = (
    <div className="mb-3 space-y-1.5 border-b border-slate-200 pb-3">
      {hours.enabled && (
        <div className="flex items-start gap-2.5 text-[13px]">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${open ? 'bg-emerald-400' : 'bg-slate-400'}`} aria-hidden />
          <p className="text-slate-700">
            {open
              ? <>Usually replies within <strong className="font-semibold text-slate-900">{replyPromise(hours)}</strong>.</>
              : <>Offline now, back <strong className="font-semibold text-slate-900">{nextOpenText(hours)}</strong>. Message any time, it&apos;s saved for them.</>}
            <span className="block text-xs text-slate-500">Replies {hoursSummary(hours)} (UK time)</span>
          </p>
        </div>
      )}
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Icon name="info" className="mt-px h-3.5 w-3.5 shrink-0" />
        Coaching support for training and nutrition. For medical worries or anything urgent, contact your GP, NHS 111, or 999 in an emergency.
      </p>
    </div>
  );
  return (
    <div className="space-y-3">
      <AutoRefresh seconds={15} />
      <header className="flex items-center gap-3"><Avatar name={coachName} size={36} /><h1>{coachName}</h1></header>
      <div className="card">
        <Conversation tall messages={(msgs ?? []).reverse()} me="client" action={sendClientMessage} hidden={{}} banner={banner}
          placeholder="Message your coach…" emptyText="Say hi to your coach. Questions, wins, anything. They’ll reply here." />
      </div>
    </div>
  );
}
