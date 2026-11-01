import { requireCoach } from '@/lib/auth';
import { Badge, Card } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { createExercise, deleteExercise } from '../programs/actions';
import type { Exercise } from '@/lib/types';

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireCoach();
  let q = supabase.from('exercises').select('*').order('name');
  if (sp.q) q = q.ilike('name', `%${sp.q}%`);
  const { data } = await q;
  const exercises = (data ?? []) as Exercise[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1>Exercise library</h1>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form className="mb-4"><input name="q" defaultValue={sp.q} placeholder="Search exercises…" className="input" /></form>
          <ul className="divide-y divide-slate-100">
            {exercises.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-2 text-slate-500">{e.muscle_group} · {e.equipment}</span>
                  {e.video_url && <a href={e.video_url} target="_blank" rel="noreferrer" className="ml-2 link">video</a>}
                </div>
                {e.coach_id ? (
                  <form action={deleteExercise} className="flex items-center gap-2"><Badge tone="blue">yours</Badge>
                    <input type="hidden" name="id" value={e.id} /><button className="text-xs text-red-600 hover:underline">delete</button></form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Add your own exercise">
          <form action={createExercise} className="space-y-3">
            <label className="block"><span className="label">Name</span><input name="name" required className="input" /></label>
            <label className="block"><span className="label">Muscle group</span><input name="muscle_group" className="input" placeholder="e.g. Glutes" /></label>
            <label className="block"><span className="label">Equipment</span><input name="equipment" className="input" /></label>
            <label className="block"><span className="label">Demo video link (YouTube, Vimeo, Drive)</span><input name="video_url" type="url" className="input" placeholder="https://" /></label>
            <label className="block"><span className="label">Coaching cues</span><textarea name="instructions" rows={3} className="input" /></label>
            <SubmitButton className="btn-primary w-full">Add exercise</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
