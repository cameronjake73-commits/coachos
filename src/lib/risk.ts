/**
 * Rule-based client risk scoring. Deterministic and explainable: every point
 * comes with a human-readable reason so the coach can see *why* a client is flagged.
 */
import type { RiskLevel } from '@/lib/types';

export interface RiskInput {
  checkinDay: number;                     // coach's weekly check-in day (0 = Sunday)
  lastCheckinAt: string | null;
  recentCheckins: {                       // newest first
    training_adherence: number | null;
    nutrition_adherence: number | null;
    energy: number | null;
    stress: number | null;
    sleep_quality: number | null;
  }[];
  plannedWorkoutsPerWeek: number;          // workouts in active programme
  workoutsLast14Days: number;
  lastClientMessageAt: string | null;
  paymentStatus: 'paid' | 'due' | 'overdue' | 'cancelled';
  renewalDate: string | null;
  startDate: string | null;
}

export interface RiskResult { score: number; level: RiskLevel; reasons: string[] }

const days = (d: string | null) => (d ? (Date.now() - new Date(d).getTime()) / 86_400_000 : null);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function scoreClientRisk(i: RiskInput): RiskResult {
  let score = 0;
  const reasons: string[] = [];
  const add = (pts: number, why: string) => { score += pts; reasons.push(why); };

  // 1. Check-in consistency
  const sinceCheckin = days(i.lastCheckinAt);
  if (sinceCheckin == null) {
    const tenure = days(i.startDate) ?? 0;
    if (tenure > 9) add(25, 'Has never submitted a check-in');
  } else if (sinceCheckin > 15) add(30, `No check-in for ${Math.floor(sinceCheckin)} days`);
  else if (sinceCheckin > 8) add(18, 'Missed last weekly check-in');

  // 2. Adherence trend (latest vs previous 3)
  const [latest, ...prev] = i.recentCheckins;
  if (latest) {
    const t = latest.training_adherence, n = latest.nutrition_adherence;
    const pt = avg(prev.slice(0, 3).map((c) => c.training_adherence));
    const pn = avg(prev.slice(0, 3).map((c) => c.nutrition_adherence));
    if (t != null && pt != null && pt - t >= 20) add(15, `Training adherence dropped from ~${Math.round(pt)}% to ${t}%`);
    else if (t != null && t < 50) add(10, `Low training adherence (${t}%)`);
    if (n != null && pn != null && pn - n >= 20) add(12, `Nutrition adherence dropped from ~${Math.round(pn)}% to ${n}%`);
    else if (n != null && n < 50) add(8, `Low nutrition adherence (${n}%)`);

    const e = latest.energy, pe = avg(prev.slice(0, 3).map((c) => c.energy));
    if (e != null && pe != null && pe - e >= 3) add(8, 'Energy noticeably lower than usual');
    if (latest.stress != null && latest.stress >= 8) add(6, `High stress reported (${latest.stress}/10)`);
    if (latest.sleep_quality != null && latest.sleep_quality <= 3) add(5, 'Poor sleep reported');
  }

  // 3. Workout logging vs plan
  if (i.plannedWorkoutsPerWeek > 0) {
    const expected = i.plannedWorkoutsPerWeek * 2;
    const ratio = i.workoutsLast14Days / expected;
    if (i.workoutsLast14Days === 0) add(20, 'No workouts logged in 14 days');
    else if (ratio < 0.5) add(12, `Logged ${i.workoutsLast14Days} of ~${expected} planned workouts in 14 days`);
  }

  // 4. Communication
  const sinceMsg = days(i.lastClientMessageAt);
  if (sinceMsg != null && sinceMsg > 21) add(6, `No messages from client for ${Math.floor(sinceMsg)} days`);

  // 5. Payments & renewal
  if (i.paymentStatus === 'overdue') add(20, 'Payment overdue');
  else if (i.paymentStatus === 'due') add(6, 'Payment due');
  if (i.renewalDate) {
    const until = -(days(i.renewalDate) ?? 0);
    if (until >= 0 && until <= 10 && score >= 15) add(10, `Renewal in ${Math.ceil(until)} days while engagement is slipping`);
  }

  score = Math.min(100, Math.round(score));
  const level: RiskLevel = score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score, level, reasons };
}
