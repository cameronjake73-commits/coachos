import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Alert, Card, Field, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { ConfirmButton } from '@/components/form-bits';
import { deleteExercise, updateExercise } from '../../programs/actions';
import type { Exercise } from '@/lib/types';

export default async function EditExercise({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { data } = await supabase.from('exercises').select('*').eq('id', id).eq('coach_id', coach.id).maybeSingle();
  if (!data) notFound();
  const e = data as Exercise;
  const { count } = await supabase.from('workout_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Edit exercise" back={{ href: '/coach/exercises', label: 'Exercise library' }} description={count ? `Used in ${count} programme slot${count === 1 ? '' : 's'}. Changes show everywhere it's used.` : undefined} />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      <Card>
        <form action={updateExercise} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <Field label="Name"><input name="name" required maxLength={120} defaultValue={e.name} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Muscle group"><input name="muscle_group" maxLength={60} defaultValue={e.muscle_group ?? ''} className="input" /></Field>
            <Field label="Equipment"><input name="equipment" maxLength={60} defaultValue={e.equipment ?? ''} className="input" /></Field>
          </div>
          <Field label="Demo video link"><input name="video_url" type="url" defaultValue={e.video_url ?? ''} className="input" placeholder="https://" /></Field>
          <Field label="Coaching cues"><textarea name="instructions" rows={4} maxLength={3000} defaultValue={e.instructions ?? ''} className="input" /></Field>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <SubmitButton pendingText="Saving…">Save exercise</SubmitButton>
            {e.video_url && <a href={e.video_url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><Icon name="play" className="h-4 w-4" />Watch demo</a>}
          </div>
        </form>
      </Card>
      <form className="flex justify-end">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton formAction={deleteExercise} message={`Delete “${e.name}”?`} className="btn-ghost btn-sm text-red-700"><Icon name="trash" className="h-4 w-4" />Delete exercise</ConfirmButton>
      </form>
    </div>
  );
}
