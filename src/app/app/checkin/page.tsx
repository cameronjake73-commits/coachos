import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { submitCheckin } from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { PhotoSlot, RangeField, ScaleField } from '@/components/checkin-inputs';
import { Alert } from '@/components/ui';
import { checkinStatus, DAYS, relativeDay } from '@/lib/coaching';
import { MEASUREMENTS, type CheckinQuestion } from '@/lib/types';

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, client } = await requireClient();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: coach }, { data: last }, { count: workouts }] = await Promise.all([
    supabase.from('coaches').select('checkin_questions, checkin_measurements, checkin_day, business_name').eq('id', client.coach_id).single(),
    supabase.from('checkins').select('submitted_at, weight_kg').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('completed_at', since),
  ]);
  const questions = (coach?.checkin_questions ?? []) as CheckinQuestion[];
  const measured = new Set<string>((coach?.checkin_measurements as string[] | null) ?? ['waist']);
  const status = checkinStatus(client, last?.[0]?.submitted_at, coach?.checkin_day ?? 0);

  if (sp.submitted) {
    return (
      <div className="card mt-8 animate-fade-up text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-400">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <h1 className="mt-4">Check-in sent</h1>
        <p className="mt-2 text-sm text-slate-600">Nice work. Your coach will review it and reply here in the app.</p>
        <Link href="/app" className="btn-primary mt-5 w-full">Back home</Link>
      </div>
    );
  }

  return (
    <form action={submitCheckin} className="space-y-4">
      <div>
        <h1>Weekly check-in</h1>
        <p className="mt-1 text-sm text-slate-500">Takes about 3 minutes. {status.state === 'submitted' ? 'You\'ve already checked in this week. You can send another if something changed.' : `Due ${relativeDay(status.due)} (${DAYS[coach?.checkin_day ?? 0]}).`}</p>
      </div>
      {sp.error && <Alert tone="red">{sp.error}</Alert>}

      <section className="card space-y-4">
        <h2>Body</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Weight (kg)</span>
            <input name="weight_kg" type="number" step="0.1" min="20" max="400" inputMode="decimal" className="input num" placeholder={last?.[0]?.weight_kg ? String(last[0].weight_kg) : ''} /></label>
          {MEASUREMENTS.filter((m) => measured.has(m.id)).map((m) => (
            <label key={m.id} className="block"><span className="label">{m.label} ({m.unit})</span>
              <input name={m.key} type="number" step={m.unit === '%' ? '0.1' : '0.5'} min={m.unit === '%' ? '2' : '10'} max={m.unit === '%' ? '70' : '300'} inputMode="decimal" className="input num" /></label>
          ))}
        </div>
        <p className="text-xs text-slate-500">Weigh in at the same time each week, ideally first thing in the morning.</p>
      </section>

      <section className="card space-y-3">
        <div><h2>Progress photos</h2><p className="mt-0.5 text-xs text-slate-500">Optional. Only your coach can see them.</p></div>
        <div className="grid grid-cols-3 gap-2">
          <PhotoSlot name="photo_front" label="Front" />
          <PhotoSlot name="photo_side" label="Side" />
          <PhotoSlot name="photo_back" label="Back" />
        </div>
      </section>

      <section className="card space-y-5">
        <h2>Your week</h2>
        <RangeField name="training_adherence" label="Training: planned sessions done" defaultValue={80} />
        <p className="-mt-3 text-xs text-slate-500">You logged {workouts ?? 0} workout{workouts === 1 ? '' : 's'} in the app over the last 7 days.</p>
        <RangeField name="nutrition_adherence" label="Nutrition: days on plan" defaultValue={80} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Avg sleep (hours)</span><input name="sleep_hours" type="number" step="0.5" min="0" max="24" inputMode="decimal" className="input num" /></label>
          <label className="block"><span className="label">Avg daily steps</span><input name="avg_steps" type="number" min="0" max="100000" inputMode="numeric" className="input num" /></label>
        </div>
        <ScaleField name="sleep_quality" label="Sleep quality" low="Poor" high="Great" />
        <ScaleField name="energy" label="Energy" low="Exhausted" high="Full of energy" />
        <ScaleField name="stress" label="Stress" low="Calm" high="Very stressed" />
        <ScaleField name="hunger" label="Hunger" low="Not hungry" high="Starving" />
      </section>

      <section className="card space-y-4">
        <h2>Reflect</h2>
        <label className="block"><span className="label">Biggest win this week</span><textarea name="wins" rows={2} maxLength={2000} className="input" /></label>
        <label className="block"><span className="label">Biggest struggle</span><textarea name="struggles" rows={2} maxLength={2000} className="input" /></label>
        <label className="block"><span className="label">Questions for your coach</span><textarea name="questions" rows={2} maxLength={2000} className="input" /></label>
      </section>

      {questions.length > 0 && (
        <section className="card space-y-4">
          <h2>From {coach?.business_name || 'your coach'}</h2>
          {questions.map((q) => q.type === 'scale' ? (
            <ScaleField key={q.id} name={`custom_${q.id}`} label={q.label} low="1" high="10" />
          ) : q.type === 'yesno' ? (
            <fieldset key={q.id}>
              <legend className="label">{q.label}</legend>
              <div className="grid grid-cols-2 gap-2">
                {['yes', 'no'].map((v) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name={`custom_${q.id}`} value={v} className="peer sr-only" />
                    <span className="flex h-11 items-center justify-center rounded-xl border border-slate-300 text-sm capitalize peer-checked:border-brand-500 peer-checked:bg-brand-600 peer-checked:text-white">{v}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <label key={q.id} className="block"><span className="label">{q.label}</span><textarea name={`custom_${q.id}`} rows={2} maxLength={2000} className="input" /></label>
          ))}
        </section>
      )}

      <div className="sticky bottom-20 z-10 pt-1">
        <SubmitButton className="btn-primary w-full py-3 shadow-pop" pendingText="Sending…">Submit check-in</SubmitButton>
      </div>
    </form>
  );
}
