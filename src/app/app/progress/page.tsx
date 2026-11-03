import { requireClient } from '@/lib/auth';
import { LineChart } from '@/components/charts';
import { Delta, EmptyState } from '@/components/ui';
import { firstLast } from '@/lib/progress';
import { shortDate } from '@/lib/format';
import { MEASUREMENTS, type Checkin } from '@/lib/types';

export default async function Progress() {
  const { supabase, client } = await requireClient();
  const [{ data: cis }, { data: photos }, { count: total }] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', client.id).order('submitted_at').limit(104),
    supabase.from('progress_photos').select('storage_path, pose, taken_at').eq('client_id', client.id).order('taken_at').limit(90),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
  ]);
  const rows = (cis ?? []) as Checkin[];
  const w = firstLast(rows, 'weight_kg');
  const weights = rows.filter((r) => r.weight_kg != null).slice(-12);
  const vals = weights.map((r) => Number(r.weight_kg));
  const measures = MEASUREMENTS.map((m) => ({ ...m, fl: firstLast(rows, m.key as keyof Checkin) })).filter((m) => m.fl && m.fl.count > 1);
  const front = (photos ?? []).filter((p) => p.pose === 'front');
  const pool = front.length >= 2 ? front : photos ?? [];
  const pair = pool.length >= 2 ? [pool[0], pool[pool.length - 1]] : pool.length ? [pool[pool.length - 1]] : [];
  const signed = pair.length ? (await supabase.storage.from('progress-photos').createSignedUrls(pair.map((p) => p.storage_path), 600)).data : [];

  return (
    <div className="space-y-4">
      <h1>Your progress</h1>
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><div className="num text-xl font-semibold">{w && w.count > 1 ? `${w.change > 0 ? '+' : ''}${w.change}kg` : '—'}</div><div className="text-2xs text-slate-500">Weight change</div></div>
        <div className="card p-3 text-center"><div className="num text-xl font-semibold">{rows.length}</div><div className="text-2xs text-slate-500">Check-ins</div></div>
        <div className="card p-3 text-center"><div className="num text-xl font-semibold">{total ?? 0}</div><div className="text-2xs text-slate-500">Workouts</div></div>
      </div>

      <section className="card">
        <h2>Weight</h2>
        {vals.length < 2 ? <EmptyState compact icon="scale" title="Your chart starts after two weigh-ins" /> : (
          <div className="mt-2"><LineChart labels={weights.map((r) => shortDate(r.submitted_at))} current={vals} min={Math.floor(Math.min(...vals) - 1)} max={Math.ceil(Math.max(...vals) + 1)} unit="" /></div>
        )}
        {client.target_weight_kg && w && <p className="mt-2 text-[13px] text-slate-500">Target {client.target_weight_kg}kg · {Math.abs(Math.round((w.last - Number(client.target_weight_kg)) * 10) / 10)}kg {w.last > Number(client.target_weight_kg) ? 'to go' : 'from target'}</p>}
      </section>

      {measures.length > 0 && (
        <section className="card">
          <h2>Measurements</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {measures.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{m.label}</span>
                <span className="flex items-center gap-3"><span className="num text-slate-500">{m.fl!.first} → {m.fl!.last}{m.unit}</span><Delta value={m.fl!.change} unit={m.unit} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {signed?.length ? (
        <section className="card">
          <h2>{signed.length === 2 ? 'Then and now' : 'Latest photo'}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">{signed.map((p, i) => p.signedUrl && (
            <figure key={i}><img src={p.signedUrl} alt={i === 0 && signed.length === 2 ? 'First photo' : 'Latest photo'} className="aspect-[3/4] w-full rounded-xl object-cover" /><figcaption className="mt-1 text-center text-xs text-slate-500">{shortDate(pair[i].taken_at)}</figcaption></figure>
          ))}</div>
        </section>
      ) : null}
    </div>
  );
}
