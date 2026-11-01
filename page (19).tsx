import { requireClient } from '@/lib/auth';
import { submitCheckin } from '../actions';
import { SubmitButton } from '@/components/submit-button';

const Scale = ({ name, label, low, high }: { name: string; label: string; low: string; high: string }) => (
  <fieldset>
    <legend className="label">{label}</legend>
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} className="peer sr-only" />
          <span className="block rounded-md border border-slate-300 py-2 text-center text-sm peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">{v}</span>
        </label>
      ))}
    </div>
    <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{low}</span><span>{high}</span></div>
  </fieldset>
);

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, client } = await requireClient();
  const { data: coach } = await supabase.from('coaches').select('checkin_questions').eq('id', client.coach_id).single();
  const questions = (coach?.checkin_questions ?? []) as { id: string; label: string }[];

  if (sp.submitted) {
    return (
      <div className="card mt-10 text-center">
        <div className="text-4xl">✓</div>
        <h1 className="mt-2">Check-in sent</h1>
        <p className="mt-2 text-sm text-slate-600">Your coach will review it and reply here in the app.</p>
        <a href="/app" className="btn-primary mt-4">Back home</a>
      </div>
    );
  }

  return (
    <form action={submitCheckin} className="space-y-4">
      <h1>Weekly check-in</h1>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      <section className="card space-y-4">
        <h2 className="text-base">Body</h2>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Weight (kg)</span><input name="weight_kg" type="number" step="0.1" inputMode="decimal" className="input" /></label>
          <label><span className="label">Waist (cm)</span><input name="waist_cm" type="number" step="0.5" inputMode="decimal" className="input" /></label>
        </div>
        <label className="block"><span className="label">Progress photos (front, side, back — optional)</span>
          <input name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" /></label>
      </section>
      <section className="card space-y-4">
        <h2 className="text-base">This week</h2>
        <label className="block"><span className="label">Training: % of planned sessions done</span>
          <input name="training_adherence" type="range" min={0} max={100} step={10} defaultValue={80} className="w-full accent-brand-600" /></label>
        <label className="block"><span className="label">Nutrition: % of days on plan</span>
          <input name="nutrition_adherence" type="range" min={0} max={100} step={10} defaultValue={80} className="w-full accent-brand-600" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Avg sleep (hours)</span><input name="sleep_hours" type="number" step="0.5" inputMode="decimal" className="input" /></label>
          <label><span className="label">Avg daily steps</span><input name="avg_steps" type="number" inputMode="numeric" className="input" /></label>
        </div>
        <Scale name="sleep_quality" label="Sleep quality" low="Poor" high="Great" />
        <Scale name="energy" label="Energy" low="Exhausted" high="Full of energy" />
        <Scale name="stress" label="Stress" low="Calm" high="Very stressed" />
        <Scale name="hunger" label="Hunger" low="Not hungry" high="Starving" />
      </section>
      <section className="card space-y-4">
        <label className="block"><span className="label">Biggest win this week</span><textarea name="wins" rows={2} className="input" /></label>
        <label className="block"><span className="label">Biggest struggle</span><textarea name="struggles" rows={2} className="input" /></label>
        <label className="block"><span className="label">Questions for your coach</span><textarea name="questions" rows={2} className="input" /></label>
        {questions.map((q) => (
          <label key={q.id} className="block"><span className="label">{q.label}</span><textarea name={`custom_${q.id}`} rows={2} className="input" /></label>
        ))}
      </section>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Sending…">Submit check-in</SubmitButton>
    </form>
  );
}
