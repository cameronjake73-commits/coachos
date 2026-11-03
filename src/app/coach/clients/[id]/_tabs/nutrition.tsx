import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, Field } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { MacroInputs } from '@/components/macro-inputs';
import { BarChart } from '@/components/charts';
import { saveNutrition } from '../../actions';
import { shortDate, timeAgo } from '@/lib/format';
import type { Client } from '@/lib/types';

export async function NutritionTab({ supabase, client }: { supabase: SupabaseClient; client: Client }) {
  const [{ data: n }, { data: cis }] = await Promise.all([
    supabase.from('nutrition_targets').select('*').eq('client_id', client.id).maybeSingle(),
    supabase.from('checkins').select('submitted_at, nutrition_adherence, hunger').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(8),
  ]);
  const hist = (cis ?? []).slice().reverse().filter((r) => r.nutrition_adherence != null);
  const ob = client.onboarding ?? {};

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Targets and habits" description={n?.updated_at ? `Last updated ${timeAgo(n.updated_at)}. ${client.full_name.split(' ')[0]} sees these on their home screen.` : `${client.full_name.split(' ')[0]} will see these on their home screen.`} className="lg:col-span-2">
        <form action={saveNutrition} className="space-y-4">
          <input type="hidden" name="client_id" value={client.id} />
          <MacroInputs initial={{ calories: n?.calories ?? null, protein_g: n?.protein_g ?? null, carbs_g: n?.carbs_g ?? null, fat_g: n?.fat_g ?? null, water_l: n?.water_l ?? null }} />
          <Field label="Daily habits" hint="One per line. Shown as a checklist in their app.">
            <textarea name="habits" rows={4} defaultValue={(n?.habits ?? []).join('\n')} className="input" placeholder={'8,000 steps\n7+ hours sleep\nProtein at every meal'} />
          </Field>
          <Field label="Notes for client"><textarea name="notes" rows={3} defaultValue={n?.notes ?? ''} maxLength={3000} className="input" placeholder="e.g. Aim for 2 portions of veg at lunch and dinner." /></Field>
          <SubmitButton pendingText="Saving…">Save targets</SubmitButton>
        </form>
      </Card>
      <div className="space-y-5">
        <Card title="Nutrition adherence" description="% of days on plan, from check-ins">
          {hist.length ? <BarChart values={hist.map((r) => r.nutrition_adherence as number)} labels={hist.map((r) => shortDate(r.submitted_at))} height={110} showLabels format={(v) => `${v}%`} />
            : <p className="text-[13px] text-slate-500">Appears after their first check-in.</p>}
          {hist.length > 0 && hist[hist.length - 1].hunger != null && <p className="mt-3 text-xs text-slate-500">Latest hunger rating: {hist[hist.length - 1].hunger}/10</p>}
        </Card>
        <Card title="From onboarding">
          <dl className="space-y-2.5 text-[13px]">
            <div><dt className="text-xs text-slate-500">Current eating & dietary needs</dt><dd className="whitespace-pre-wrap text-slate-800">{ob.diet || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Lifestyle</dt><dd className="whitespace-pre-wrap text-slate-800">{ob.lifestyle || '—'}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
