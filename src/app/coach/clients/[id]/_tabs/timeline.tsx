import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { longDate } from '@/lib/format';
import type { Client } from '@/lib/types';

type Ev = { at: string; icon: string; tone: string; title: string; body?: string; href?: string };

/** Everything that has happened with this client, newest first: check-ins, replies, messages, workouts and programme changes. */
export async function TimelineTab({ supabase, client }: { supabase: SupabaseClient; client: Client }) {
  const [{ data: cis }, { data: msgs }, { data: logs }, { data: progs }] = await Promise.all([
    supabase.from('checkins').select('id, submitted_at, weight_kg, training_adherence, nutrition_adherence, status, replied_at').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(40),
    supabase.from('messages').select('id, sender, body, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(60),
    supabase.from('workout_logs').select('id, workout_name, completed_at, session_rpe').eq('client_id', client.id).order('completed_at', { ascending: false }).limit(40),
    supabase.from('programs').select('id, name, created_at').eq('client_id', client.id).order('created_at', { ascending: false }),
  ]);
  const base = `/coach/clients/${client.id}`;
  const first = client.full_name.split(' ')[0];
  const ev: Ev[] = [
    ...(cis ?? []).map((c) => ({ at: c.submitted_at, icon: 'checkins', tone: 'bg-emerald-50 text-emerald-400', title: `${first} submitted a check-in`, body: [c.weight_kg != null && `${c.weight_kg}kg`, c.training_adherence != null && `training ${c.training_adherence}%`, c.nutrition_adherence != null && `nutrition ${c.nutrition_adherence}%`].filter(Boolean).join(' · '), href: `/coach/checkins/${c.id}` })),
    ...(msgs ?? []).map((m) => {
      const feedback = m.body.startsWith('Check-in feedback:');
      return { at: m.created_at, icon: feedback ? 'check' : 'messages', tone: m.sender === 'coach' ? 'bg-brand-50 text-brand-300' : 'bg-sky-50 text-sky-400', title: feedback ? 'You replied to their check-in' : m.sender === 'coach' ? 'You sent a message' : `${first} sent a message`, body: m.body.replace(/^Check-in feedback:\s*/, '').slice(0, 180), href: `${base}?tab=messages` };
    }),
    ...(logs ?? []).map((l) => ({ at: l.completed_at, icon: 'dumbbell', tone: 'bg-slate-100 text-slate-500', title: `Logged ${l.workout_name}`, body: l.session_rpe ? `Session RPE ${l.session_rpe}` : undefined, href: `${base}?tab=training` })),
    ...(progs ?? []).map((p) => ({ at: p.created_at, icon: 'programs', tone: 'bg-amber-50 text-amber-400', title: `Programme assigned: ${p.name}`, href: `/coach/programs/${p.id}` })),
    { at: client.created_at, icon: 'user', tone: 'bg-slate-100 text-slate-500', title: 'Added as a client' },
    ...(client.health_consent_at ? [{ at: client.health_consent_at, icon: 'checkCircle', tone: 'bg-emerald-50 text-emerald-400', title: `${first} joined and completed onboarding` }] : []),
    ...(client.archived_at ? [{ at: client.archived_at, icon: 'archive', tone: 'bg-slate-100 text-slate-500', title: 'Archived' }] : []),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 120);

  let lastDay = '';
  return (
    <Card>
      {ev.length <= 1 ? <EmptyState compact icon="clock" title="Nothing yet">Check-ins, messages and workouts will appear here as they happen.</EmptyState> : (
        <ol className="relative">
          {ev.map((e, i) => {
            const day = longDate(e.at);
            const show = day !== lastDay;
            lastDay = day;
            const inner = (
              <div className="flex gap-3 py-2">
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${e.tone}`}><Icon name={e.icon} className="h-3.5 w-3.5" strokeWidth={2} /></span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-slate-900">{e.title}</span>
                    <span className="shrink-0 text-2xs text-slate-500">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {e.body && <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-500">{e.body}</p>}
                </div>
              </div>
            );
            return (
              <li key={i}>
                {show && <div className="eyebrow mb-1 mt-4 first:mt-0">{day}</div>}
                <div className="relative before:absolute before:bottom-0 before:left-4 before:top-0 before:w-px before:bg-slate-200">
                  {e.href ? <Link href={e.href} className="-mx-2 block rounded-lg px-2 hover:bg-raised">{inner}</Link> : inner}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
