import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Card, Empty } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { createProgram } from './actions';

export default async function ProgramsPage() {
  const { supabase, coach } = await requireCoach();
  const { data } = await supabase.from('programs').select('id, name, client_id, is_active, workouts(id), clients(full_name)').eq('coach_id', coach.id).order('created_at', { ascending: false });
  const templates = (data ?? []).filter((p) => !p.client_id);
  const assigned = (data ?? []).filter((p) => p.client_id && p.is_active);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1>Programmes</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Templates">
          <p className="mb-3 text-sm text-slate-500">Build once, assign to any client. Assigning makes a copy you can personalise.</p>
          {!templates.length ? <Empty>No templates yet.</Empty> : (
            <ul className="space-y-2">{templates.map((p) => (
              <li key={p.id}><Link href={`/coach/programs/${p.id}`} className="flex justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <span className="font-medium">{p.name}</span><span className="text-sm text-slate-500">{p.workouts?.length ?? 0} workouts</span></Link></li>
            ))}</ul>
          )}
          <form action={createProgram} className="mt-4 flex gap-2">
            <input name="name" required placeholder="e.g. 4-day Upper/Lower" className="input" />
            <SubmitButton className="btn-primary whitespace-nowrap">New template</SubmitButton>
          </form>
        </Card>
        <Card title="Active client programmes">
          {!assigned.length ? <Empty>Assign a programme from a client&apos;s Training tab.</Empty> : (
            <ul className="space-y-2">{assigned.map((p) => (
              <li key={p.id}><Link href={`/coach/programs/${p.id}`} className="flex justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <span><span className="font-medium">{p.name}</span><span className="block text-xs text-slate-500">{(p.clients as unknown as { full_name: string })?.full_name}</span></span>
                <span className="text-sm text-slate-500">{p.workouts?.length ?? 0} workouts</span></Link></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
