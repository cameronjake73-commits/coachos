import { EmptyState } from '@/components/ui';
import { ChatPane } from '@/components/chat-pane';

type Msg = { id: string; sender: 'coach' | 'client'; body: string; created_at: string; read_at: string | null; is_auto?: boolean };

const dayLabel = (d: string) => {
  const date = new Date(d), today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 864e5);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : date.toLocaleDateString('en-GB', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short', year: diff > 300 ? 'numeric' : undefined });
};

/** Chat thread + composer. `me` is whoever is viewing (their bubbles sit on the right). */
export function Conversation({ messages, me, action, hidden, draft, placeholder = 'Write a message…', emptyText, composerNote, tall = false, afterSend, quickReplies, firstName, banner }: {
  messages: Msg[]; me: 'coach' | 'client'; action: (fd: FormData) => void | Promise<void>; hidden: Record<string, string>;
  draft?: string; placeholder?: string; emptyText?: string; composerNote?: React.ReactNode; tall?: boolean; afterSend?: string;
  quickReplies?: { title: string; body: string }[]; firstName?: string; banner?: React.ReactNode;
}) {
  let lastDay = '';
  const list = !messages.length && !draft ? <EmptyState compact icon="messages" title="No messages yet">{emptyText}</EmptyState> : messages.map((m) => {
    const day = dayLabel(m.created_at);
    const showDay = day !== lastDay;
    lastDay = day;
    const mine = m.sender === me;
    const isFeedback = m.body.startsWith('Check-in feedback:');
    return (
      <div key={m.id}>
        {showDay && <div className="my-3 text-center text-2xs font-medium uppercase tracking-wider text-slate-500">{day}</div>}
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed md:max-w-[75%] ${m.is_auto ? 'opacity-75' : ''} ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-200 bg-slate-100/70 text-slate-900'}`}>
            {m.is_auto && <div className={`mb-1 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider ${mine ? 'text-brand-100' : 'text-slate-500'}`}>Automatic reply</div>}
            {isFeedback && <div className={`mb-1 text-2xs font-semibold uppercase tracking-wider ${mine ? 'text-brand-100' : 'text-brand-300'}`}>Check-in feedback</div>}
            {isFeedback ? m.body.replace(/^Check-in feedback:\s*/, '') : m.body}
            <div className={`mt-1 text-right text-[10px] ${mine ? 'text-brand-100/80' : 'text-slate-500'}`}>
              {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}{mine && m.read_at ? ' · Read' : ''}
            </div>
          </div>
        </div>
      </div>
    );
  });
  return (
    <ChatPane list={<div className="space-y-1.5">{list}</div>} action={action} hidden={hidden} draft={draft} placeholder={placeholder} composerNote={composerNote} afterSend={afterSend} quickReplies={quickReplies} firstName={firstName} banner={banner}
      scrollClass={`overflow-y-auto overscroll-contain pr-1 ${tall ? 'max-h-[calc(100dvh-330px)] min-h-[240px] md:max-h-[calc(100vh-300px)]' : 'max-h-[520px]'}`} />
  );
}
