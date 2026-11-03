/**
 * Deterministic coaching logic shared by the dashboard, check-ins, client profiles and the client app.
 * Everything here is computed from real data. No AI and no guesses.
 */
import type { Client } from '@/lib/types';

const DAY = 86_400_000;
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Clients can submit up to this many days before the check-in day. */
export const WINDOW_DAYS = 3;

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** The check-in cycle that applies right now for a coach's weekly check-in day (0 = Sunday). */
export function checkinCycle(checkinDay: number, now = new Date()) {
  const today = startOfDay(now);
  const back = (today.getDay() - checkinDay + 7) % 7;
  const lastDue = new Date(today.getTime() - back * DAY);
  const nextDue = back === 0 ? lastDue : new Date(lastDue.getTime() + 7 * DAY);
  const nextOpens = new Date(nextDue.getTime() - WINDOW_DAYS * DAY);
  const due = now >= nextOpens ? nextDue : lastDue;
  return {
    due,
    opensAt: new Date(due.getTime() - WINDOW_DAYS * DAY),
    closesAt: new Date(due.getTime() + DAY),
    nextDue: due.getTime() === nextDue.getTime() ? new Date(nextDue.getTime() + 7 * DAY) : nextDue,
  };
}

export type CheckinState = 'submitted' | 'due' | 'missed' | 'new';

export interface CheckinStatus {
  state: CheckinState;
  /** Consecutive weekly check-ins missed (only when state is "missed"). */
  missedCount: number;
  due: Date;
  lastAt: string | null;
}

/** Where a client stands for the current check-in cycle. */
export function checkinStatus(client: Pick<Client, 'start_date' | 'created_at'>, lastCheckinAt: string | null | undefined, checkinDay: number, now = new Date()): CheckinStatus {
  const cyc = checkinCycle(checkinDay, now);
  const last = lastCheckinAt ? new Date(lastCheckinAt) : null;
  const started = new Date(client.start_date ?? client.created_at);
  const base = { due: cyc.due, lastAt: lastCheckinAt ?? null, missedCount: 0 };
  if (last && last >= cyc.opensAt) return { ...base, state: 'submitted' };
  if (started > cyc.opensAt && !last) return { ...base, state: 'new' };
  if (now < cyc.closesAt) return { ...base, state: 'due' };
  const from = last && last > started ? last : started;
  const missedCount = Math.max(1, Math.floor((cyc.due.getTime() - from.getTime() + (last ? WINDOW_DAYS * DAY : 0)) / (7 * DAY)));
  return { ...base, state: 'missed', missedCount: Math.min(missedCount, 52) };
}

export function relativeDay(d: Date, now = new Date()) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Adds whole months to a yyyy-mm-dd date, clamping to the end of shorter months. */
export function addMonths(date: string | null | undefined, months = 1) {
  const base = date ? new Date(date + 'T12:00:00') : new Date();
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d.toISOString().slice(0, 10);
}

export interface ClientAlert { tone: 'red' | 'amber' | 'blue'; title: string; detail?: string; href?: string; action?: string }

/** Plain-language alerts for one client, most urgent first. */
export function clientAlerts(c: Client, ctx: { status?: CheckinStatus; hasProgramme?: boolean; hasNutrition?: boolean; unread?: number; base?: string }): ClientAlert[] {
  const out: ClientAlert[] = [];
  const base = ctx.base ?? `/coach/clients/${c.id}`;
  if (c.status === 'invited') {
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY);
    if (days >= 3) out.push({ tone: 'amber', title: `Invite not accepted after ${days} days`, detail: 'Resend the invite link by DM or email.', href: base, action: 'Resend' });
    return out;
  }
  if (c.status !== 'active') return out;
  if (c.payment_status === 'overdue') out.push({ tone: 'red', title: 'Payment overdue', href: `${base}?tab=details`, action: 'Update' });
  if (ctx.status?.state === 'missed') out.push({ tone: ctx.status.missedCount >= 2 ? 'red' : 'amber', title: ctx.status.missedCount >= 2 ? `Missed ${ctx.status.missedCount} check-ins in a row` : 'Missed this week’s check-in', detail: ctx.status.lastAt ? `Last check-in ${new Date(ctx.status.lastAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Has not checked in yet', href: `${base}?tab=messages&draft=1`, action: 'Nudge' });
  if (c.renewal_date) {
    const until = Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / DAY);
    if (until >= 0 && until <= 7) out.push({ tone: c.risk_level === 'high' ? 'red' : 'blue', title: `Renews ${until === 0 ? 'today' : `in ${until} day${until === 1 ? '' : 's'}`}`, detail: c.risk_level === 'high' ? 'Engagement is slipping. Check in before it renews.' : undefined, href: `${base}?tab=details` });
    else if (until < 0 && c.payment_status !== 'paid') out.push({ tone: 'amber', title: `Renewal date passed ${-until} day${until === -1 ? '' : 's'} ago`, detail: 'Record the renewal or update the payment status.', href: `${base}?tab=details`, action: 'Update' });
  }
  if (ctx.hasProgramme === false) out.push({ tone: 'amber', title: 'No training programme assigned', href: `${base}?tab=training`, action: 'Assign' });
  if (ctx.hasNutrition === false) out.push({ tone: 'blue', title: 'No nutrition targets set', href: `${base}?tab=nutrition`, action: 'Set' });
  if ((ctx.unread ?? 0) > 0) out.push({ tone: 'blue', title: `${ctx.unread} unread message${ctx.unread === 1 ? '' : 's'}`, href: `${base}?tab=messages`, action: 'Reply' });
  return out;
}

/** Brzycki-style estimated one-rep max, used to spot performance changes. */
export const e1rm = (kg: number | null, reps: number | null) => (kg && reps && reps > 0 && reps <= 15 ? kg * (36 / (37 - reps)) : null);
