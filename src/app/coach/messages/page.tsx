import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { EmptyState, PageHeader, RiskBadge } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { Conversation } from '@/components/conversation';
import { SubmitButton } from '@/components/submit-button';
import { generateDraft, sendCoachMessage } from '../clients/actions';
import { aiEnabled } from '@/lib/ai';
import { timeAgo } from '@/lib/format';
import type { RiskLevel } from '@/lib/types';

type Thread = { id: string; full_name: string; status: string; risk_level: RiskLevel; last: { body: string; sender: string; created_at: string } | null; unread: number };

export default async function MessagesInbox({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; draft?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const [{ data: msgs }, { data: clients }] = await Promise.all([
    supabase.from('messages').select('client_id, sender, body, created_at, read_at').eq('coach_id', coach.id).order('created_at', { ascending: false }).limit(2000),
    supabase.from('clients').select('id, full_name, status, risk_level, ai_draft, ai_draft_at, email_reminders').eq('coach_id', coach.id).neq('status', 'archived').order('full_name'),
  ]);
  const byClient = new Map<string, Thread>();
  for (const c of clients ?? []) byClient.set(c.id, { id: c.id, full_name: c.full_name, status: c.status, risk_level: c.risk_level, last: null, unread: 0 });
  for (const m of msgs ?? []) {
    const t = byClient.get(m.client_id);
    if (!t) continue;
    if (!t.last) t.last = m;
    if (m.sender === 'client' && !m.read_at) t.unread++;
  }
  const q = sp.q?.trim().toLowerCase() ?? '';
  const threads = [...byClient.values()].filter((t) => t.last && (!q || t.full_name.toLowerCase().includes(q)))
    .sort((a, b) => (b.unread - a.unread) || (a.last!.created_at < b.last!.created_at ? 1 : -1));
  const quiet = [...byClient.values()].filter((t) => !t.last && t.status === 'active' && (!q || t.full_name.toLowerCase().includes(q)));
  const selected = sp.c ? (clients ?? []).find((c) => c.id === sp.c) : null;

  let convo: React.ReactNode = null;
  if (selected) {
    const { data: thread } = await supabase.from('messages').select('id, sender, body, created_at, read_at').eq('client_id', selected.id).order('created_at', { ascending: false }).limit(200);
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', selected.id).eq('sender', 'client').is('read_at', null);
    const t = byClient.get(selected.id);
    if (t) t.unread = 0;
    const draft = sp.draft === 'ai' && selected.ai_draft ? selected.ai_draft : '';
    const back = `/coach/messages?c=${selected.id}`;
    convo = (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Link href="/coach/messages" className="icon-btn -ml-2 md:hidden" aria-label="All conversations"><Icon name="chevronLeft" /></Link>
          <Avatar name={selected.full_name} size={34} />
          <div className="min-w-0 flex-1">
            <Link href={`/coach/clients/${selected.id}`} className="block truncate font-medium hover:underline">{selected.full_name}</Link>
            <span className="text-xs text-slate-500">{selected.status === 'invited' ? 'Hasn’t joined yet' : 'Client'}</span>
          </div>
          {selected.status === 'active' && <RiskBadge level={selected.risk_level} />}
        </div>
        <div className="flex-1 px-4 pb-4 pt-2">
          <Conversation
            tall messages={(thread ?? []).reverse()} me="coach" action={sendCoachMessage}
            hidden={{ client_id: selected.id, back, ...(draft ? { used_draft: '1' } : {}) }} draft={draft}
            placeholder={`Message ${selected.full_name.split(' ')[0]}…`}
            emptyText={`Say hello to ${selected.full_name.split(' ')[0]}. They'll see it in their app.`}
            composerNote={aiEnabled() && !draft ? (
              <form action={generateDraft} className="mb-2"><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-ghost btn-sm -ml-2" pendingText="Drafting…"><Icon name="sparkle" className="h-3.5 w-3.5 text-brand-300" />Draft a check-in message with AI</SubmitButton></form>
            ) : draft ? <p className="mb-2 flex items-center gap-1.5 text-xs text-brand-100"><Icon name="sparkle" className="h-3.5 w-3.5" />AI draft based on their data. Edit before sending.</p> : null}
          />
        </div>
      </div>
    );
  }

  const list = (
    <div className="flex h-full flex-col">
      <form className="border-b border-slate-200 p-3" role="search">
        {sp.c && <input type="hidden" name="c" value={sp.c} />}
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input name="q" defaultValue={sp.q} placeholder="Search conversations" aria-label="Search conversations" className="input pl-9" />
        </div>
      </form>
      <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto">
        {threads.map((t) => (
          <li key={t.id}>
            <Link href={`/coach/messages?c=${t.id}`} aria-current={sp.c === t.id ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-3 transition ${sp.c === t.id ? 'bg-brand-50' : 'hover:bg-raised'}`}>
              <Avatar name={t.full_name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${t.unread ? 'font-semibold text-slate-900' : 'font-medium'}`}>{t.full_name}</span>
                  <span className="shrink-0 text-2xs text-slate-500">{timeAgo(t.last!.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${t.unread ? 'text-slate-800' : 'text-slate-500'}`}>{t.last!.sender === 'coach' ? 'You: ' : ''}{t.last!.body.replace(/^Check-in feedback:\s*/, '').replace(/\s+/g, ' ')}</span>
                  {t.unread > 0 && <span className="num rounded-full bg-red-500 px-1.5 text-2xs font-semibold leading-5 text-white">{t.unread}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!threads.length && <li className="p-4"><EmptyState compact icon="messages" title={q ? 'No conversations found' : 'No conversations yet'}>Pick a client below to send the first message.</EmptyState></li>}
        {quiet.length > 0 && (
          <li className="p-4">
            <div className="eyebrow mb-2">Start a conversation</div>
            <div className="flex flex-wrap gap-1.5">
              {quiet.map((c) => <Link key={c.id} href={`/coach/messages?c=${c.id}`} className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-[13px] transition hover:border-slate-300 hover:bg-slate-100"><Avatar name={c.full_name} size={22} />{c.full_name.split(' ')[0]}</Link>)}
            </div>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AutoRefresh seconds={20} />
      <div className={selected ? 'hidden md:block' : ''}><PageHeader title="Messages" actions={<Link href="/coach/messages/broadcast" className="btn-secondary"><Icon name="send" className="h-4 w-4" />Message several</Link>} /></div>
      <div className="card-flush overflow-hidden md:grid md:h-[calc(100vh-200px)] md:min-h-[520px] md:grid-cols-[320px_1fr]">
        <div className={`${selected ? 'hidden md:block' : ''} md:border-r md:border-slate-200`}>{list}</div>
        <div className={selected ? '' : 'hidden md:flex md:items-center md:justify-center'}>
          {convo ?? <EmptyState icon="messages" title="Select a conversation">Choose a client on the left to read and reply.</EmptyState>}
        </div>
      </div>
    </div>
  );
}
