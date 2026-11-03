import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, EmptyState, Field, PageHeader, Segmented } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { createExercise } from '../programs/actions';
import type { Exercise } from '@/lib/types';

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; group?: string; mine?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireCoach();
  const { data } = await supabase.from('exercises').select('*').order('name');
  const all = (data ?? []) as Exercise[];
  const groups = [...new Set(all.map((e) => e.muscle_group || 'Other'))].sort();
  const q = sp.q?.trim().toLowerCase() ?? '';
  const list = all.filter((e) => (!sp.group || (e.muscle_group || 'Other') === sp.group) && (!sp.mine || e.coach_id) && (!q || e.name.toLowerCase().includes(q) || (e.equipment ?? '').toLowerCase().includes(q)));
  const link = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, group: sp.group, mine: sp.mine, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/coach/exercises${p.toString() ? `?${p}` : ''}`;
  };
  const mineCount = all.filter((e) => e.coach_id).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Exercise library" description={`${all.length} exercises · ${mineCount} added by you`} />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <form className="relative" role="search">
            {sp.group && <input type="hidden" name="group" value={sp.group} />}
            {sp.mine && <input type="hidden" name="mine" value={sp.mine} />}
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input name="q" defaultValue={sp.q} placeholder="Search exercises or equipment" aria-label="Search exercises" className="input pl-9" />
          </form>
          <Segmented items={[
            { href: link({ group: undefined, mine: undefined }), label: 'All', active: !sp.group && !sp.mine },
            { href: link({ mine: '1', group: undefined }), label: 'Yours', active: !!sp.mine, count: mineCount },
            ...groups.map((g) => ({ href: link({ group: g, mine: undefined }), label: g, active: sp.group === g })),
          ]} />
          <Card flush>
            {list.length === 0 ? <div className="p-4"><EmptyState compact icon="search" title="No exercises found">Try another search, or add it as your own exercise.</EmptyState></div> : (
              <ul className="divide-y divide-slate-200">
                {list.map((e) => {
                  const inner = (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon name="dumbbell" className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="truncate font-medium text-slate-900">{e.name}</span>{e.coach_id && <Badge tone="brand">yours</Badge>}</span>
                        <span className="block truncate text-xs text-slate-500">{[e.muscle_group, e.equipment].filter(Boolean).join(' · ') || '—'}{e.instructions ? ` · ${e.instructions}` : ''}</span>
                      </span>
                      {e.video_url && <Icon name="play" className="h-4 w-4 shrink-0 text-slate-400" />}
                      {e.coach_id && <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-400" />}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.coach_id
                        ? <Link href={`/coach/exercises/${e.id}`} className="row-link flex items-center gap-3 px-4 py-3">{inner}</Link>
                        : e.video_url ? <a href={e.video_url} target="_blank" rel="noreferrer" className="row-link flex items-center gap-3 px-4 py-3">{inner}</a>
                          : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Add your own exercise" description="Appears in the programme builder and your clients' workouts." className="h-fit lg:sticky lg:top-24">
          <form action={createExercise} className="space-y-3">
            <Field label="Name"><input name="name" required maxLength={120} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Muscle group"><input name="muscle_group" list="groups" maxLength={60} className="input" placeholder="e.g. Glutes" /></Field>
              <Field label="Equipment"><input name="equipment" maxLength={60} className="input" placeholder="e.g. Cable" /></Field>
            </div>
            <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <Field label="Demo video link" hint="YouTube, Vimeo, Google Drive… must start with https://"><input name="video_url" type="url" inputMode="url" className="input" placeholder="https://" /></Field>
            <Field label="Coaching cues"><textarea name="instructions" rows={3} maxLength={3000} className="input" /></Field>
            <SubmitButton className="btn-primary w-full" pendingText="Adding…">Add exercise</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
