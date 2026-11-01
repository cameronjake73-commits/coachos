import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { daysSince } from '@/lib/format';
import { signOut } from '@/app/login/actions';
import type { Workout } from '@/lib/types';

export default async function ClientHome() {
  const { supabase, client } = await requireClient();
  const [{ data: coach }, { data: prog }, { data: lastCi }, { data: nut }, { data: lastLog }] = await Promise.all([
    supabase.from('coaches').select('business_name, checkin_day').eq('id', client.coach_id).single(),
    supabase.from('programs').select('id, name, workouts(id, name, position, workout_exercises(id))').eq('client_id', client.id).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('checkins').select('submitted_at, coach_reply, status').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('nutrition_targets').select('*').eq('client_id', client.id).maybeSingle(),
    supabase.from('workout_logs').select('workout_id, completed_at').eq('client_id', client.id).order('completed_at', { ascending: false }).limit(1),
  ]);
  const workouts = ((prog?.workouts ?? []) as Workout[]).sort((a, b) => a.position - b.position);
  const lastIdx = workouts.findIndex((w) => w.id === lastLog?.[0]?.workout_id);
  const next = workouts.length ? workouts[(lastIdx + 1) % workouts.length] : null;
  const sinceCi = daysSince(lastCi?.[0]?.submitted_at);
  const checkinDue = sinceCi == null || sinceCi >= 6;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{coach?.business_name || 'Your coaching'}</p>
          <h1>Hi {client.full_name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <form action={signOut}><button className="text-xs text-slate-400">Sign out</button></form>
          <a href="/api/export/me" className="text-xs text-slate-400">Download my data</a>
        </div>
      </header>

      {checkinDue && (
        <Link href="/app/checkin" className="block rounded-xl bg-brand-600 p-4 text-white shadow-sm">
          <div className="text-sm opacity-90">Weekly check-in {sinceCi == null ? '' : 'due'}</div>
          <div className="text-lg font-semibold">Submit your check-in →</div>
          <div className="text-xs opacity-80">Your coach reviews check-ins every {days[coach?.checkin_day ?? 0]}</div>
        </Link>
      )}

      <section className="card">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Next workout</div>
        {next ? (
          <Link href={`/app/workouts/${next.id}`} className="mt-1 flex items-center justify-between">
            <div><div className="text-lg font-semibold">{next.name}</div><div className="text-sm text-slate-500">{next.workout_exercises?.length ?? 0} exercises · {prog?.name}</div></div>
            <span className="btn-primary">Start</span>
          </Link>
        ) : <p className="mt-1 text-sm text-slate-500">Your coach hasn&apos;t assigned a programme yet.</p>}
      </section>

      {nut && (
        <section className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Daily targets</div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            {[['kcal', nut.calories], ['Protein', nut.protein_g && `${nut.protein_g}g`], ['Carbs', nut.carbs_g && `${nut.carbs_g}g`], ['Fat', nut.fat_g && `${nut.fat_g}g`]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-slate-50 p-2"><div className="text-base font-semibold">{v || '—'}</div><div className="text-[11px] text-slate-500">{l}</div></div>
            ))}
          </div>
          {nut.water_l ? <p className="mt-2 text-sm text-slate-600">Water: {nut.water_l}L</p> : null}
          {nut.habits?.length ? (
            <ul className="mt-3 space-y-1 text-sm">{(nut.habits as string[]).map((h) => <li key={h} className="flex gap-2"><span className="text-brand-600">✓</span>{h}</li>)}</ul>
          ) : null}
          {nut.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{nut.notes}</p>}
        </section>
      )}

      <p className="px-1 text-center text-xs text-slate-400">Tip: add this app to your home screen. iPhone: Share → Add to Home Screen. Android: ⋮ → Install app.</p>

      {lastCi?.[0]?.coach_reply && (
        <section className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest feedback from your coach</div>
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm">{lastCi[0].coach_reply}</p>
          <Link href="/app/messages" className="mt-2 inline-block text-sm link">Reply</Link>
        </section>
      )}
    </div>
  );
}
