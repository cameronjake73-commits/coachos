import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Badge, Card, Delta, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { assignTemplate, createProgram } from '@/app/coach/programs/actions';
import { trainingPerformance } from '@/lib/performance';
import { shortDate } from '@/lib/format';
import type { Client, Coach } from '@/lib/types';

type SetRow = { exercise_name: string; set_number: number; reps: number | null; weight_kg: number | null };

function summariseSets(sets: SetRow[]) {
  const by = new Map<string, string[]>();
  for (const s of [...sets].sort((a, b) => a.set_number - b.set_number)) {
    const arr = by.get(s.exercise_name) ?? [];
    arr.push(`${s.weight_kg ?? 0}×${s.reps ?? 0}`);
    by.set(s.exercise_name, arr);
  }
  return [...by.entries()];
}

export async function TrainingTab({ supabase, coach, client }: { supabase: SupabaseClient; coach: Coach; client: Client }) {
  const [{ data: progs }, { data: templates }, { data: logs }, perf] = await Promise.all([
    supabase.from('programs').select('id, name, description, is_active, created_at, workouts(id, name, position, workout_exercises(id))').eq('client_id', client.id).order('created_at', { ascending: false }),
    supabase.from('programs').select('id, name, workouts(id)').eq('coach_id', coach.id).is('client_id', null).order('name'),
    supabase.from('workout_logs').select('id, workout_name, completed_at, session_rpe, notes, set_logs(exercise_name, set_number, reps, weight_kg)').eq('client_id', client.id).order('completed_at', { ascending: false }).limit(12),
    trainingPerformance(supabase, client.id, new Date().toISOString()),
  ]);
  const active = progs?.find((p) => p.is_active);
  const others = (progs ?? []).filter((p) => p.id !== active?.id);
  const days = (active?.workouts ?? []).sort((a, b) => a.position - b.position);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-2">
        <Card title="Current programme" action={active && <Link href={`/coach/programs/${active.id}`} className="btn-secondary btn-sm"><Icon name="edit" className="h-4 w-4" />Edit</Link>}>
          {!active ? <EmptyState compact icon="programs" title="No programme assigned">Assign one of your templates or build one just for {client.full_name.split(' ')[0]}.</EmptyState> : (
            <>
              <div className="font-medium">{active.name}</div>
              {active.description && <p className="mt-1 text-[13px] text-slate-500">{active.description}</p>}
              <ul className="mt-3 space-y-1.5">
                {days.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="num flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-600">{i + 1}</span>
                    <span className="flex-1 truncate">{w.name}</span>
                    <span className="text-xs text-slate-500">{w.workout_exercises?.length ?? 0} exercises</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            {templates?.length ? (
              <form action={assignTemplate} className="space-y-2">
                <input type="hidden" name="client_id" value={client.id} />
                <label className="label" htmlFor="tpl">{active ? 'Replace with a template' : 'Assign a template'}</label>
                <div className="flex gap-2">
                  <select id="tpl" name="template_id" className="input" required>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.workouts?.length ?? 0} days)</option>)}</select>
                  <SubmitButton className="btn-secondary" pendingText="Assigning…">Assign</SubmitButton>
                </div>
                <p className="hint">Makes a personal copy for this client. Your template isn&apos;t changed.</p>
              </form>
            ) : <p className="text-[13px] text-slate-500">Tip: build reusable templates in <Link href="/coach/programs" className="link">Programmes</Link>.</p>}
            <form action={createProgram} className="space-y-2">
              <input type="hidden" name="client_id" value={client.id} />
              <label className="label" htmlFor="newprog">Or start from scratch</label>
              <div className="flex gap-2">
                <input id="newprog" name="name" required maxLength={120} placeholder="Programme name" className="input" />
                <SubmitButton className="btn-primary" pendingText="Creating…">Create</SubmitButton>
              </div>
            </form>
          </div>
        </Card>

        {others.length > 0 && (
          <Card title="Previous programmes">
            <ul className="space-y-1.5">{others.map((p) => (
              <li key={p.id}><Link href={`/coach/programs/${p.id}`} className="row-link flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span><span className="flex items-center gap-2 text-xs text-slate-500">{shortDate(p.created_at)}<Badge>inactive</Badge></span></Link></li>
            ))}</ul>
          </Card>
        )}
      </div>

      <div className="space-y-5 lg:col-span-3">
        <Card title="Strength this week" description="Best set per exercise vs the 3 weeks before (estimated 1RM)">
          {!perf.exercises.length ? <EmptyState compact icon="dumbbell" title="No sets logged in the last 7 days" /> : (
            <ul className="divide-y divide-slate-200">
              {perf.exercises.slice(0, 8).map((x) => (
                <li key={x.exercise} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{x.exercise}</span>
                  <span className="num text-slate-600">{x.thisWeek!.kg}kg × {x.thisWeek!.reps}</span>
                  <span className="w-16 text-right text-[13px]">{x.change != null ? <Delta value={x.change} unit="%" goodWhen="up" /> : <span className="text-xs text-slate-500">new</span>}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">{perf.sessions} session{perf.sessions === 1 ? '' : 's'} in the last 7 days{perf.avgRpe ? ` · average RPE ${perf.avgRpe}` : ''}</p>
        </Card>

        <Card title="Workout log" flush>
          {!logs?.length ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="dumbbell" title="No workouts logged yet" /></div> : (
            <ul className="divide-y divide-slate-200 border-t border-slate-200">{logs.map((l) => (
              <li key={l.id} className="px-4 py-3 md:px-5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-300"><Icon name="dumbbell" className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.workout_name}</span><span className="block text-xs text-slate-500">{shortDate(l.completed_at)}{l.session_rpe ? ` · RPE ${l.session_rpe}` : ''} · {(l.set_logs ?? []).length} sets</span></span>
                    <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-1 pl-11 text-[13px]">
                    {summariseSets((l.set_logs ?? []) as SetRow[]).map(([name, sets]) => <div key={name}><span className="text-slate-800">{name}</span> <span className="num text-slate-500">{sets.join(', ')} kg×reps</span></div>)}
                    {!(l.set_logs ?? []).length && <div className="text-slate-500">No sets recorded</div>}
                    {l.notes && <p className="pt-1 italic text-slate-500">“{l.notes}”</p>}
                  </div>
                </details>
              </li>))}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
