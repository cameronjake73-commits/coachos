import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, Delta, EmptyState } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { firstLast } from '@/lib/progress';
import { longDate, shortDate } from '@/lib/format';
import { MEASUREMENTS, type Checkin, type Client } from '@/lib/types';

const METRICS = [{ key: 'weight_kg', label: 'Weight', unit: 'kg' }, ...MEASUREMENTS] as const;

export async function ProgressTab({ supabase, client }: { supabase: SupabaseClient; client: Client }) {
  const [{ data: cis }, { data: photos }] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', client.id).order('submitted_at').limit(104),
    supabase.from('progress_photos').select('id, storage_path, pose, taken_at, checkin_id').eq('client_id', client.id).order('taken_at', { ascending: false }).limit(60),
  ]);
  const rows = (cis ?? []) as Checkin[];
  const weights = rows.filter((r) => r.weight_kg != null).slice(-16);
  const wVals = weights.map((r) => Number(r.weight_kg));
  const wMin = wVals.length ? Math.floor(Math.min(...wVals, client.target_weight_kg ? Number(client.target_weight_kg) : Infinity) - 1) : 0;
  const wMax = wVals.length ? Math.ceil(Math.max(...wVals) + 1) : 100;

  const signed = photos?.length ? (await supabase.storage.from('progress-photos').createSignedUrls(photos.map((p) => p.storage_path), 900)).data ?? [] : [];
  const urlFor = new Map<string, string>();
  photos?.forEach((p, i) => { const u = signed[i]?.signedUrl; if (u) urlFor.set(p.id, u); });
  const byPose = new Map<string, typeof photos>();
  for (const p of [...(photos ?? [])].reverse()) { const k = p.pose ?? 'other'; byPose.set(k, [...(byPose.get(k) ?? []), p]); }
  const compare = [...byPose.entries()].map(([pose, list]) => ({ pose, first: list![0], last: list![list!.length - 1] })).filter((x) => x.first.id !== x.last.id);
  const sessions = new Map<string, NonNullable<typeof photos>>();
  for (const p of photos ?? []) { const k = p.taken_at.slice(0, 10); sessions.set(k, [...(sessions.get(k) ?? []), p]); }

  const direction = (key: string, first: number): 'up' | 'down' | undefined => {
    if (key === 'weight_kg') return client.target_weight_kg ? (Number(client.target_weight_kg) > first ? 'up' : 'down') : undefined;
    return key === 'waist_cm' || key === 'body_fat_pct' ? 'down' : undefined;
  };
  const tracked = METRICS.map((m) => ({ ...m, fl: firstLast(rows, m.key as keyof Checkin) })).filter((m) => m.fl);

  return (
    <div className="space-y-5">
      <Card title="Weight trend" description={weights.length ? `Last ${weights.length} weigh-ins${client.target_weight_kg ? ` · target ${client.target_weight_kg}kg` : ''}` : undefined}>
        {weights.length < 2 ? <EmptyState compact icon="scale" title="Not enough weigh-ins yet">The chart appears after two check-ins with a weight.</EmptyState>
          : <LineChart labels={weights.map((r) => shortDate(r.submitted_at))} current={wVals} min={wMin} max={wMax} unit="" empty="" />}
      </Card>

      <Card title="Measurements" description="Start → 4 weeks ago → latest" flush>
        {!tracked.length ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="ruler" title="No measurements yet">Choose which measurements clients are asked for in Settings → Weekly check-ins.</EmptyState></div> : (
          <>
            <ul className="divide-y divide-slate-200 border-t border-slate-200 md:hidden">
              {tracked.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span><span className="block font-medium">{m.label}</span><span className="num text-xs text-slate-500">{m.fl!.first}{m.unit} → {m.fl!.last}{m.unit}</span></span>
                  <Delta value={m.fl!.change} unit={m.unit} goodWhen={direction(m.key, m.fl!.first)} />
                </li>
              ))}
            </ul>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-y border-slate-200 text-left text-xs text-slate-500"><tr>
                <th className="px-5 py-2.5 font-medium">Measurement</th><th className="px-3 py-2.5 text-right font-medium">Start</th><th className="px-3 py-2.5 text-right font-medium">4 weeks ago</th><th className="px-3 py-2.5 text-right font-medium">Latest</th><th className="px-5 py-2.5 text-right font-medium">Change</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {tracked.map((m) => (
                  <tr key={m.key}>
                    <td className="px-5 py-3 font-medium">{m.label}<span className="ml-2 text-xs font-normal text-slate-500">{m.fl!.count} entries</span></td>
                    <td className="num px-3 py-3 text-right text-slate-600">{m.fl!.first}{m.unit}<div className="text-2xs text-slate-500">{shortDate(m.fl!.firstAt)}</div></td>
                    <td className="num px-3 py-3 text-right text-slate-600">{m.fl!.fourWeeks != null ? `${m.fl!.fourWeeks}${m.unit}` : '—'}</td>
                    <td className="num px-3 py-3 text-right">{m.fl!.last}{m.unit}<div className="text-2xs text-slate-500">{shortDate(m.fl!.lastAt)}</div></td>
                    <td className="px-5 py-3 text-right"><Delta value={m.fl!.change} unit={m.unit} goodWhen={direction(m.key, m.fl!.first)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      {compare.length > 0 && (
        <Card title="Before and after" description="First photo vs latest, by pose">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {compare.map((c) => (
              <div key={c.pose}>
                <div className="mb-1.5 text-xs font-medium capitalize text-slate-600">{c.pose}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[c.first, c.last].map((p, i) => urlFor.get(p.id) ? (
                    <figure key={p.id} className="relative overflow-hidden rounded-lg bg-slate-100">
                      <img src={urlFor.get(p.id)} alt={`${c.pose} ${i ? 'latest' : 'first'}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-2xs text-white">{i ? 'Latest' : 'Start'} · {shortDate(p.taken_at)}</figcaption>
                    </figure>
                  ) : null)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Photo history" description={photos?.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : undefined}>
        {!photos?.length ? <EmptyState compact icon="photo" title="No progress photos yet">Clients can add front, side and back photos with each check-in.</EmptyState> : (
          <div className="space-y-5">
            {[...sessions.entries()].map(([day, list]) => (
              <div key={day}>
                <div className="mb-2 text-xs font-medium text-slate-500">{longDate(day)}</div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                  {list.map((p) => urlFor.get(p.id) && (
                    <a key={p.id} href={urlFor.get(p.id)} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg bg-slate-100">
                      <img src={urlFor.get(p.id)} alt={p.pose ?? 'progress photo'} loading="lazy" className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] capitalize text-white">{p.pose}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-2xs text-slate-500">Photos are private. Links expire after 15 minutes.</p>
      </Card>
    </div>
  );
}
