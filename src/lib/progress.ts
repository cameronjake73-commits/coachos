import type { Checkin, Client } from '@/lib/types';

const DAY = 86_400_000;
const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function firstLast<K extends keyof Checkin>(rows: Checkin[], key: K) {
  const vals = rows.filter((r) => r[key] != null);
  if (!vals.length) return null;
  const first = Number(vals[0][key]), last = Number(vals[vals.length - 1][key]);
  const fourAgo = vals.filter((r) => new Date(r.submitted_at).getTime() <= Date.now() - 26 * DAY).pop();
  return { first, last, change: r1(last - first), fourWeeks: fourAgo ? Number(fourAgo[key]) : null, firstAt: vals[0].submitted_at, lastAt: vals[vals.length - 1].submitted_at, count: vals.length };
}

/** Deterministic, factual progress statements (no AI). `rows` oldest first. */
export function progressFacts(client: Client, rows: Checkin[], workoutsPerWeek: number[], planned: number): string[] {
  const out: string[] = [];
  const w = firstLast(rows, 'weight_kg');
  if (w && w.count >= 2) {
    out.push(`Weight ${w.change > 0 ? 'up' : w.change < 0 ? 'down' : 'unchanged'} ${Math.abs(w.change)}kg since first check-in (${w.first}kg → ${w.last}kg).`);
    if (client.target_weight_kg) {
      const left = r1(w.last - Number(client.target_weight_kg));
      out.push(left === 0 ? 'At target weight.' : `${Math.abs(left)}kg ${left > 0 ? 'above' : 'below'} target of ${client.target_weight_kg}kg.`);
    }
  }
  const waist = firstLast(rows, 'waist_cm');
  if (waist && waist.count >= 2 && waist.change !== 0) out.push(`Waist ${waist.change < 0 ? 'down' : 'up'} ${Math.abs(waist.change)}cm since first measurement.`);
  const recent = rows.slice(-4), earlier = rows.slice(-8, -4);
  const tNow = avg(recent.map((r) => r.training_adherence)), tBefore = avg(earlier.map((r) => r.training_adherence));
  const nNow = avg(recent.map((r) => r.nutrition_adherence)), nBefore = avg(earlier.map((r) => r.nutrition_adherence));
  if (tNow != null) out.push(`Training adherence averaging ${Math.round(tNow)}% over the last ${recent.length} check-ins${tBefore != null ? ` (was ${Math.round(tBefore)}%)` : ''}.`);
  if (nNow != null) out.push(`Nutrition adherence averaging ${Math.round(nNow)}%${nBefore != null ? ` (was ${Math.round(nBefore)}%)` : ''}.`);
  const weeksIn = Math.min(8, Math.max(1, Math.floor((Date.now() - new Date(client.start_date ?? client.created_at).getTime()) / (7 * DAY))));
  const recentCount = rows.filter((r) => new Date(r.submitted_at).getTime() > Date.now() - weeksIn * 7 * DAY).length;
  out.push(`Checked in ${Math.min(recentCount, weeksIn)} of the last ${weeksIn} week${weeksIn === 1 ? '' : 's'}.`);
  const last4 = workoutsPerWeek.slice(-4);
  if (last4.length) {
    const per = r1(last4.reduce((a, b) => a + b, 0) / last4.length);
    out.push(`Logging ${per} workout${per === 1 ? '' : 's'} a week on average${planned ? ` (${planned} planned)` : ''}.`);
  }
  return out;
}
