import { requireClient } from '@/lib/auth';
import { Sparkline } from '@/components/ui';
import { shortDate } from '@/lib/format';

export default async function Progress() {
  const { supabase, client } = await requireClient();
  const [{ data: cis }, { data: photos }, { count: total }] = await Promise.all([
    supabase.from('checkins').select('submitted_at, weight_kg, waist_cm, training_adherence, nutrition_adherence, energy').eq('client_id', client.id).order('submitted_at').limit(52),
    supabase.from('progress_photos').select('storage_path, pose, taken_at').eq('client_id', client.id).order('taken_at').limit(60),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
  ]);
  const rows = cis ?? [];
  const s = (k: keyof (typeof rows)[number]) => rows.map((r) => r[k] as number | null);
  const weights = rows.map((r) => r.weight_kg).filter((w): w is number => w != null);
  const change = weights.length >= 2 ? Number((weights[weights.length - 1] - weights[0]).toFixed(1)) : null;
  const first = photos?.[0], latest = photos?.length ? photos[photos.length - 1] : null;
  const pair = first && latest && first.storage_path !== latest.storage_path ? [first, latest] : latest ? [latest] : [];
  const signed = pair.length ? (await supabase.storage.from('progress-photos').createSignedUrls(pair.map((p) => p.storage_path), 600)).data : [];

  return (
    <div className="space-y-4">
      <h1>Progress</h1>
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><div className="text-xl font-semibold">{change == null ? '—' : `${change > 0 ? '+' : ''}${change}kg`}</div><div className="text-[11px] text-slate-500">Weight change</div></div>
        <div className="card p-3 text-center"><div className="text-xl font-semibold">{rows.length}</div><div className="text-[11px] text-slate-500">Check-ins</div></div>
        <div className="card p-3 text-center"><div className="text-xl font-semibold">{total ?? 0}</div><div className="text-[11px] text-slate-500">Workouts</div></div>
      </div>
      <section className="card space-y-3 text-sm">
        <div><div className="text-slate-500">Weight</div><Sparkline values={s('weight_kg')} unit="kg" /></div>
        <div><div className="text-slate-500">Waist</div><Sparkline values={s('waist_cm')} unit="cm" /></div>
        <div><div className="text-slate-500">Training adherence</div><Sparkline values={s('training_adherence')} unit="%" /></div>
        <div><div className="text-slate-500">Energy</div><Sparkline values={s('energy')} unit="/10" /></div>
      </section>
      {signed?.length ? (
        <section className="card">
          <div className="mb-2 font-semibold">{signed.length === 2 ? 'Then vs now' : 'Latest photo'}</div>
          <div className="grid grid-cols-2 gap-2">{signed.map((p, i) => p.signedUrl && (
            <figure key={i}><img src={p.signedUrl} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" /><figcaption className="mt-1 text-center text-xs text-slate-500">{shortDate(pair[i].taken_at)}</figcaption></figure>
          ))}</div>
        </section>
      ) : null}
    </div>
  );
}
