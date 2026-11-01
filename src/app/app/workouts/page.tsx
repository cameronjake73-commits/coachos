import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import type { Workout } from '@/lib/types';

export default async function ClientWorkouts({ searchParams }: { searchParams: Promise<{ logged?: string }> }) {
  const sp = await searchParams;
  const { supabase, client } = await requireClient();
  const [{ data: prog }, { data: logs }] = await Promise.all([
    supabase.from('programs').select('name, description, workouts(id, name, position, workout_exercises(id))').eq('client_id', client.id).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('workout_logs').select('id, workout_name, completed_at, session_rpe').eq('client_id', client.id).order('completed_at', { ascending: false }).limit(10),
  ]);
  const workouts = ((prog?.workouts ?? []) as Workout[]).sort((a, b) => a.position - b.position);
  return (
    <div className="space-y-4">
      <h1>Training</h1>
      {sp.logged && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Workout saved. Great work.</p>}
      {prog ? (
        <section className="card">
          <div className="font-semibold">{prog.name}</div>
          {prog.description && <p className="mt-1 text-sm text-slate-600">{prog.description}</p>}
          <ul className="mt-3 space-y-2">{workouts.map((w) => (
            <li key={w.id}><Link href={`/app/workouts/${w.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 active:bg-slate-50">
              <span className="font-medium">{w.name}</span><span className="text-sm text-slate-500">{w.workout_exercises?.length ?? 0} exercises →</span></Link></li>
          ))}</ul>
        </section>
      ) : <p className="card text-sm text-slate-500">No programme assigned yet.</p>}
      <section className="card">
        <div className="mb-2 font-semibold">History</div>
        {!logs?.length ? <p className="text-sm text-slate-500">No workouts logged yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">{logs.map((l) => (
            <li key={l.id} className="flex justify-between py-2"><span>{l.workout_name}</span><span className="text-slate-500">{shortDate(l.completed_at)}{l.session_rpe ? ` · RPE ${l.session_rpe}` : ''}</span></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
