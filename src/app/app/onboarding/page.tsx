import { requireClient } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { completeOnboarding } from '../actions';
import { SubmitButton } from '@/components/submit-button';

const Q = ({ name, label, type = 'text', area, placeholder }: { name: string; label: string; type?: string; area?: boolean; placeholder?: string }) => (
  <label className="block"><span className="label">{label}</span>
    {area ? <textarea name={name} rows={3} className="input" placeholder={placeholder} /> : <input name={name} type={type} className="input" placeholder={placeholder} />}
  </label>
);

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, client } = await requireClient({ allowIncompleteOnboarding: true });
  if (client.health_consent_at) redirect('/app');
  const { data: coach } = await supabase.from('coaches').select('business_name').eq('id', client.coach_id).single();

  return (
    <form action={completeOnboarding} className="space-y-5">
      <div>
        <h1>Welcome, {client.full_name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate-600">A few questions so {coach?.business_name || 'your coach'} can build your plan. Takes about 3 minutes.</p>
      </div>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      <div className="card space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Q name="age" label="Age" type="number" /><Q name="height_cm" label="Height (cm)" type="number" /><Q name="starting_weight_kg" label="Weight (kg)" type="number" />
        </div>
        <Q name="main_goal" label="What's your main goal?" area placeholder="e.g. Lose 8kg and feel confident on holiday in July" />
        <Q name="why_now" label="Why is this important to you right now?" area />
        <Q name="training_experience" label="Training experience" placeholder="e.g. 2 years, mostly machines" />
        <div className="grid grid-cols-2 gap-3">
          <Q name="training_days_per_week" label="Days you can train" type="number" />
          <Q name="equipment" label="Where you train" placeholder="Full gym / home" />
        </div>
        <Q name="injuries" label="Injuries, pain or medical conditions your coach should know about" area />
        <Q name="diet" label="Current eating habits & any dietary requirements" area />
        <Q name="lifestyle" label="Work, sleep and stress — what does a normal week look like?" area />
      </div>
      <div className="card space-y-3 text-sm">
        <h2 className="text-base">Your data</h2>
        <p className="text-slate-600">Your coach will use your health and fitness information (weight, measurements, sleep, energy, photos and the answers above)
          to coach you. It is stored securely and only your coach can see it. Some data is processed by an AI tool to help your coach review check-ins; your coach reviews everything. You can ask your coach to delete your data at any time.</p>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent" className="mt-1" />
          <span>I give explicit consent for my health and fitness data to be processed for my coaching, as described above and in the <a href="/privacy" className="link" target="_blank">privacy policy</a>. I am 18 or over.</span></label>
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Saving…">Finish and go to my app</SubmitButton>
    </form>
  );
}
