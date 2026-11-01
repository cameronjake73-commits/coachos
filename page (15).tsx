import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Avatar } from '@/components/avatar';
import { Card, Empty } from '@/components/ui';
import { AutoRefresh } from '@/components/auto-refresh';
import { timeAgo } from '@/lib/format';

export default async function MessagesInbox() {
  const { supabase, coach } = await requireCoach();
  const [{ data: msgs }, { data: clients }] = await Promise.all([
    supabase.from('messages').select('client_id, sender, body, created_at, read_at').eq('coach_id', coach.id).order('created_at', { ascending: false }).limit(1000),
    supabase.from('clients').select('id, full_name, status').eq('coach_id', coach.id).neq('status', 'archived'),
  ]);
  const threads = new Map<string, { last: { body: string; sender: string; created_at: string }; unread: number }>();
  for (const m of msgs ?? []) {
    const t = threads.get(m.client_id) ?? { last: m, unread: 0 };
    if (m.sender === 'client' && !m.read_at) t.unread++;
    threads.set(m.client_id, t);
  }
  const rows = (clients ?? []).filter((c) => threads.has(c.id))
    .map((c) => ({ ...c, ...threads.get(c.id)! }))
    .sort((a, b) => (b.unread - a.unread) || (a.last.created_at < b.last.created_at ? 1 : -1));
  const quiet = (clients ?? []).filter((c) => !threads.has(c.id) && c.status === 'active');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AutoRefresh seconds={20} />
      <h1>Messages</h1>
      <Card className="p-0">
        {!rows.length ? <div className="p-5"><Empty>No conversations yet. Message a client from their profile.</Empty></div> : (
          <ul className="divide-y divide-slate-200">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/coach/clients/${r.id}?tab=messages`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-100/40">
                  <Avatar name={r.full_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate ${r.unread ? 'font-semibold text-slate-900' : 'font-medium'}`}>{r.full_name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{timeAgo(r.last.created_at)}</span>
                    </div>
                    <div className={`truncate text-sm ${r.unread ? 'text-slate-800' : 'text-slate-500'}`}>{r.last.sender === 'coach' ? 'You: ' : ''}{r.last.body.replace(/\s+/g, ' ')}</div>
                  </div>
                  {r.unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{r.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {quiet.length > 0 && (
        <Card title="No messages yet">
          <div className="flex flex-wrap gap-2">
            {quiet.map((c) => <Link key={c.id} href={`/coach/clients/${c.id}?tab=messages`} className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm hover:bg-slate-100"><Avatar name={c.full_name} size={26} />{c.full_name}</Link>)}
          </div>
        </Card>
      )}
    </div>
  );
}
