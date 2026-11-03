import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { signOut } from '@/app/login/actions';
import { Icon } from '@/components/icons';
import { checkinStatus, DAYS, relativeDay } from '@/lib/coaching';
import { timeAgo } from '@/lib/format';
import type { Workout } from '@/lib/types';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function ClientHome() {
  const { supabase, client } = await requireClient();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: coach }, { data: prog }, { data: lastCi }, { data: nut }, { data: lastLog }, { count: weekLogs }] = await Promise.all([
    supabase.from('coaches').select('business_name, checkin_day').eq('id', client.coach_id).single(),
    supabase.from('programs').select('id, name, workouts(id, name, position, workout_exercises(id))').eq('client_id', client.id).eq('is_active', true).limit(1).maybeSingle(),
    supabase.from('checkins').select('submitted_at, coach_reply, replied_at, status').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('nutrition_targets').select('*').eq('client_id', client.id).maybeSingle(),
    supabase.from('workout_logs').select('workout_id, completed_at').eq('client_id', client.id).order('completed_at', { ascending: false }).limit(1),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('completed_at', since),
  ]);
  const workouts = ((prog?.workouts ?? []) as Workout[]).sort((a, b) => a.position - b.position);
  const lastIdx = workouts.findIndex((w) => w.id === lastLog?.[0]?.workout_id);
  const next = workouts.length ? workouts[(lastIdx + 1) % workouts.length] : null;
  const status = checkinStatus(client, lastCi?.[0]?.submitted_at, coach?.checkin_day ?? 0);
  const feedback = lastCi?.[0]?.coach_reply ? lastCi[0] : null;
  const planned = workouts.length;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-slate-500">{coach?.business_name || 'Your coaching'}</p>
          <h1>{greeting()}, {client.full_name.split(' ')[0]}</h1>
        </div>
        <details className="relative">
          <summary className="icon-btn list-none" aria-label="Account"><Icon name="user" /></summary>
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-300 bg-[#151827] p-1 shadow-pop">
            <a href="/api/export/me" className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-100"><Icon name="arrowDown" className="h-4 w-4" />Download my data</a>
            <a href="/privacy" className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-100"><Icon name="lock" className="h-4 w-4" />Privacy</a>
            <form action={signOut}><button className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-100"><Icon name="logout" className="h-4 w-4" />Sign out</button></form>
          </div>
        </details>
      </header>

      {status.state === 'submitted' ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <Icon name="checkCircle" className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-sm"><div className="font-medium text-slate-900">Checked in this week</div><div className="text-[13px] text-slate-600">Next check-in {relativeDay(new Date(status.due.getTime() + 7 * 864e5))}</div></div>
        </div>
      ) : (
        <Link href="/app/checkin" className={`block rounded-2xl p-4 text-white shadow-glow ${status.state === 'missed' ? 'bg-gradient-to-br from-red-600 to-[#a3214a]' : 'bg-gradient-to-br from-brand-600 to-brand-800'}`}>
          <div className="text-[13px] opacity-90">{status.state === 'missed' ? 'Your check-in is overdue' : status.state === 'due' ? `Weekly check-in · due ${relativeDay(status.due)}` : 'Weekly check-in'}</div>
          <div className="mt-0.5 flex items-center justify-between text-lg font-semibold">Submit your check-in <Icon name="arrowRight" className="h-5 w-5" /></div>
          <div className="mt-1 text-xs opacity-80">About 3 minutes · reviewed every {DAYS[coach?.checkin_day ?? 0]}</div>
        </Link>
      )}

      <section className="card">
        <div className="flex items-center justify-between"><div className="eyebrow">Next workout</div>{planned > 0 && <span className="num text-xs text-slate-500">{weekLogs ?? 0} done this week</span>}</div>
        {next ? (
          <Link href={`/app/workouts/${next.id}`} className="mt-2 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-300"><Icon name="dumbbell" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold">{next.name}</span><span className="block truncate text-[13px] text-slate-500">{next.workout_exercises?.length ?? 0} exercises · {prog?.name}</span></span>
            <span className="btn-primary btn-sm">Start</span>
          </Link>
        ) : <p className="mt-2 text-sm text-slate-500">Your coach hasn&apos;t assigned a programme yet.</p>}
      </section>

      {nut && (nut.calories || nut.protein_g || nut.habits?.length) ? (
        <section className="card">
          <div className="eyebrow">Daily targets</div>
          {(nut.calories || nut.protein_g) && (
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[['kcal', nut.calories], ['Protein', nut.protein_g && `${nut.protein_g}g`], ['Carbs', nut.carbs_g && `${nut.carbs_g}g`], ['Fat', nut.fat_g && `${nut.fat_g}g`]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-slate-100/60 px-1 py-2.5"><div className="num text-base font-semibold">{v || '—'}</div><div className="text-2xs text-slate-500">{l}</div></div>
              ))}
            </div>
          )}
          {nut.water_l ? <p className="mt-2 text-[13px] text-slate-600">Water: {nut.water_l}L a day</p> : null}
          {nut.habits?.length ? (
            <ul className="mt-3 space-y-1.5 text-sm">{(nut.habits as string[]).map((h) => <li key={h} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-brand-400" strokeWidth={2.4} />{h}</li>)}</ul>
          ) : null}
          {nut.notes && <p className="mt-3 whitespace-pre-wrap border-t border-slate-200 pt-3 text-[13px] text-slate-600">{nut.notes}</p>}
        </section>
      ) : null}

      {feedback && (
        <section className="card">
          <div className="flex items-center justify-between"><div className="eyebrow">Latest feedback from your coach</div><span className="text-2xs text-slate-500">{timeAgo(feedback.replied_at ?? feedback.submitted_at)}</span></div>
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm">{feedback.coach_reply}</p>
          <Link href="/app/messages" className="mt-2 inline-flex items-center gap-1 text-[13px] link">Reply <Icon name="arrowRight" className="h-3.5 w-3.5" /></Link>
        </section>
      )}

      <p className="px-2 text-center text-xs text-slate-500">Tip: add this app to your home screen. iPhone: Share → Add to Home Screen. Android: ⋮ → Install app.</p>
    </div>
  );
}
