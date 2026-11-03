import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Avatar } from '@/components/avatar';
import { SubmitButton } from '@/components/submit-button';
import { createProgram } from './actions';
import { timeAgo } from '@/lib/format';

type Row = { id: string; name: string; description: string | null; client_id: string | null; is_active: boolean; created_at: string; workouts: { id: string; workout_exercises: { id: string }[] }[]; clients: { full_name: string; status: string } | null };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { data } = await supabase.from('programs').select('id, name, description, client_id, is_active, created_at, workouts(id, workout_exercises(id)), clients(full_name, status)').eq('coach_id', coach.id).order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const templates = rows.filter((p) => !p.client_id);
  const assigned = rows.filter((p) => p.client_id && p.is_active && p.clients?.status !== 'archived');
  const usesOf = (name: string) => assigned.filter((a) => a.name === name).length;
  const exCount = (p: Row) => p.workouts.reduce((n, w) => n + (w.workout_exercises?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Programmes" description="Build templates once, then assign a personal copy to any client." />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2>Templates</h2><span className="text-xs text-slate-500">{templates.length}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((p) => (
            <Link key={p.id} href={`/coach/programs/${p.id}`} className="card group flex flex-col transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-300"><Icon name="programs" className="h-[18px] w-[18px]" /></span>
                {usesOf(p.name) > 0 && <Badge tone="blue">{usesOf(p.name)} using</Badge>}
              </div>
              <div className="mt-3 font-medium text-slate-900 group-hover:underline">{p.name}</div>
              {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-slate-500">{p.description}</p>}
              <div className="mt-auto pt-3 text-xs text-slate-500">{p.workouts.length} day{p.workouts.length === 1 ? '' : 's'} · {exCount(p)} exercises</div>
            </Link>
          ))}
          <form action={createProgram} className="card flex flex-col justify-between gap-3 border-dashed">
            <div>
              <div className="font-medium">New template</div>
              <p className="mt-1 text-[13px] text-slate-500">e.g. 4-day Upper/Lower, Beginner full body</p>
            </div>
            <label className="sr-only" htmlFor="tname">Template name</label>
            <input id="tname" name="name" required maxLength={120} placeholder="Template name" className="input" />
            <SubmitButton className="btn-primary" pendingText="Creating…"><Icon name="plus" className="h-4 w-4" />Create template</SubmitButton>
          </form>
        </div>
      </section>

      <Card title="Active client programmes" description="Each client has their own copy, so you can personalise it." flush>
        {!assigned.length ? (
          <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="clients" title="No client programmes yet">Open a template and assign it, or create one from a client&apos;s Training tab.</EmptyState></div>
        ) : (
          <ul className="divide-y divide-slate-200 border-t border-slate-200">
            {assigned.map((p) => (
              <li key={p.id}>
                <Link href={`/coach/programs/${p.id}`} className="row-link flex items-center gap-3 px-4 py-3 md:px-5">
                  <Avatar name={p.clients?.full_name ?? '?'} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.clients?.full_name}</span><span className="block truncate text-[13px] text-slate-500">{p.name}</span></span>
                  <span className="hidden text-xs text-slate-500 sm:block">{p.workouts.length} days · created {timeAgo(p.created_at)}</span>
                  <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
