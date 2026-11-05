/**
 * Coach working hours, evaluated in UK time (Europe/London), so clients see when to expect a reply
 * and coaches aren't pinged at night.
 */
export type Hours = { enabled: boolean; days: number[]; start: string; end: string; replyWithin: number };

export const TZ = 'Europe/London';
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function hoursFrom(c: { hours_enabled?: boolean | null; hours_days?: number[] | null; hours_start?: string | null; hours_end?: string | null; reply_within_hours?: number | null }): Hours {
  const start = TIME.test(c.hours_start ?? '') ? c.hours_start! : '09:00';
  const end = TIME.test(c.hours_end ?? '') ? c.hours_end! : '18:00';
  const days = (c.hours_days ?? [1, 2, 3, 4, 5]).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return { enabled: Boolean(c.hours_enabled) && days.length > 0 && start < end, days: [...new Set(days)].sort(), start, end, replyWithin: c.reply_within_hours || 24 };
}

/** Day of week (0–6) and minutes since midnight in UK time. */
export function ukClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { day: DAY_SHORT.indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** True when the coach is inside their working hours (always true when hours are switched off). */
export function isOpen(h: Hours, now = new Date()) {
  if (!h.enabled) return true;
  const { day, minutes } = ukClock(now);
  return h.days.includes(day) && minutes >= mins(h.start) && minutes < mins(h.end);
}

export function fmtTime(t: string) {
  const [hh, mm] = [Number(t.slice(0, 2)), t.slice(3, 5)];
  const h12 = hh % 12 || 12;
  return `${h12}${mm === '00' ? '' : `:${mm}`}${hh < 12 ? 'am' : 'pm'}`;
}

/** When the coach is next available, in words: "today at 9am", "tomorrow at 9am", "on Monday at 9am". */
export function nextOpenText(h: Hours, now = new Date()) {
  if (!h.enabled || isOpen(h, now)) return 'soon';
  const { day, minutes } = ukClock(now);
  for (let add = 0; add <= 7; add++) {
    const d = (day + add) % 7;
    if (!h.days.includes(d)) continue;
    if (add === 0 && minutes >= mins(h.start)) continue;
    const at = `at ${fmtTime(h.start)}`;
    return add === 0 ? `today ${at}` : add === 1 ? `tomorrow ${at}` : `on ${DAY_LONG[d]} ${at}`;
  }
  return 'soon';
}

/** "Mon–Fri, 9am–6pm" / "Mon, Wed, Fri, 7am–7pm". */
export function hoursSummary(h: Hours) {
  // Work in Monday-first positions (Mon = 0 … Sun = 6) so Fri–Sun style ranges join up.
  const pos = h.days.map((d) => (d + 6) % 7).sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const p of pos) { const last = runs.at(-1); if (last && last.at(-1)! + 1 === p) last.push(p); else runs.push([p]); }
  const name = (p: number) => DAY_SHORT[(p + 1) % 7];
  const days = pos.length === 7 ? 'Every day' : runs.map((r) => (r.length >= 3 ? `${name(r[0])}–${name(r.at(-1)!)}` : r.map(name).join(', '))).join(', ');
  return `${days}, ${fmtTime(h.start)}–${fmtTime(h.end)}`;
}

export function replyPromise(h: Hours) {
  const n = h.replyWithin;
  return n % 24 === 0 && n >= 24 ? `${n / 24 === 1 ? '1 working day' : `${n / 24} working days`}` : `${n} hours`;
}

export const DEFAULT_AUTO_REPLY = "Thanks {name}! I'm offline right now, but your message is saved and I'll get back to you {next}.";

export function autoReplyText(template: string | null | undefined, firstName: string, next: string) {
  return (template?.trim() || DEFAULT_AUTO_REPLY).replaceAll('{name}', firstName).replaceAll('{next}', next).slice(0, 2000);
}

export type QuickReply = { title: string; body: string };
export function quickRepliesFrom(raw: unknown): QuickReply[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q) => q && typeof q.body === 'string' && q.body.trim())
    .slice(0, 12).map((q) => ({ title: String(q.title || q.body).trim().slice(0, 40), body: String(q.body).trim().slice(0, 2000) }));
}
