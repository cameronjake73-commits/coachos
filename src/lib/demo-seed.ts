/**
 * Builds (or resets) a fully populated DEMO account for sales calls. Used by `npm run seed:demo`
 * and by the protected /api/demo/seed route. Server-only: needs the service-role client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recomputeRisk } from '@/lib/risk-service';

let admin: SupabaseClient;
const log = (..._a: unknown[]) => {};

let COACH_EMAIL = 'demo@coachos.app';
let CLIENT_EMAIL = 'client@coachos.app';
let PASSWORD = 'DemoCoach2026!';
const DAY = 86_400_000;

// Deterministic randomness so the demo looks the same every time
let seed = 42;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const jitter = (n: number, spread: number) => n + (rand() - 0.5) * 2 * spread;
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const dateOnly = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function must(p: PromiseLike<{ data: any; error: { message: string } | null }>, what: string): Promise<any> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  if (data == null) throw new Error(`${what}: no data returned`);
  return data;
}

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

type Pattern = 'star' | 'steady' | 'drifting' | 'ghost' | 'overdue' | 'renewal' | 'new';
interface Persona {
  name: string; goal: string; fee: number; pattern: Pattern; startWeight: number; renewalIn: number; months: number;
  pending?: 'improving' | 'declining' | 'stable'; login?: boolean;
}

const PEOPLE: Persona[] = [
  { name: 'Emma Walsh', months: 6, goal: 'Lose 6kg before her wedding in June', fee: 160, pattern: 'star', startWeight: 72.4, renewalIn: 18, login: true },
  { name: 'Liam Carter', months: 5, goal: 'Drop to 85kg and keep his strength', fee: 150, pattern: 'drifting', startWeight: 93.8, renewalIn: 9, pending: 'declining' },
  { name: 'Priya Shah', months: 8, goal: 'First physique competition, May', fee: 200, pattern: 'star', startWeight: 61.2, renewalIn: 22, pending: 'improving' },
  { name: 'Dan Morris', months: 4, goal: 'Get fit for his 40th: run 10k and lose the belly', fee: 130, pattern: 'ghost', startWeight: 98.1, renewalIn: 12 },
  { name: 'Chloe Bennett', months: 7, goal: 'Build glutes and get stronger', fee: 140, pattern: 'steady', startWeight: 64.0, renewalIn: 25, pending: 'stable' },
  { name: "Ryan O'Neill", months: 3.2, goal: 'Recomp: lose fat, add muscle', fee: 150, pattern: 'overdue', startWeight: 82.5, renewalIn: -3 },
  { name: 'Hannah Price', months: 5.5, goal: 'Lose 10kg postnatal, feel like herself again', fee: 140, pattern: 'renewal', startWeight: 79.6, renewalIn: 5 },
  { name: 'Tom Evans', months: 10, goal: 'Bench 120kg, squat 180kg', fee: 120, pattern: 'steady', startWeight: 88.0, renewalIn: 14 },
  { name: 'Aisha Khan', months: 2.4, goal: 'Lose 5kg and fix her energy crashes', fee: 150, pattern: 'star', startWeight: 70.3, renewalIn: 8 },
  { name: 'Josh Reid', months: 0.8, goal: 'Lean bulk to 80kg', fee: 120, pattern: 'new', startWeight: 74.2, renewalIn: 27 },
  { name: 'Megan Hughes', months: 1.6, goal: 'Lose 8kg and build a routine she can stick to', fee: 140, pattern: 'steady', startWeight: 76.9, renewalIn: 19 },
];

const TEMPLATE = {
  name: '4-Day Upper / Lower',
  description: 'Progressive overload: add a rep or 2.5kg when you hit the top of the rep range on every set.',
  days: [
    { name: 'Upper A (Strength)', ex: [['Barbell Bench Press', 4, '5-7', 'RPE 8', 60], ['Barbell Row', 4, '6-8', 'RPE 8', 50], ['Seated Dumbbell Shoulder Press', 3, '8-10', 'RPE 8', 18], ['Lat Pulldown', 3, '10-12', 'RPE 9', 45], ['Triceps Pushdown', 3, '12-15', 'RPE 9', 20]] },
    { name: 'Lower A (Squat)', ex: [['Barbell Back Squat', 4, '5-7', 'RPE 8', 80], ['Romanian Deadlift', 3, '8-10', 'RPE 8', 60], ['Leg Press', 3, '10-12', 'RPE 9', 120], ['Seated Leg Curl', 3, '12-15', 'RPE 9', 35], ['Standing Calf Raise', 4, '10-12', 'RPE 9', 50]] },
    { name: 'Upper B (Hypertrophy)', ex: [['Incline Dumbbell Press', 3, '8-12', 'RPE 9', 24], ['Chest-supported Row', 3, '10-12', 'RPE 9', 30], ['Cable Lateral Raise', 3, '12-15', 'RPE 9', 7.5], ['Pull-up', 3, '6-10', 'RPE 9', 0], ['Incline Dumbbell Curl', 3, '10-12', 'RPE 9', 10]] },
    { name: 'Lower B (Hinge)', ex: [['Hip Thrust', 4, '8-10', 'RPE 8', 90], ['Bulgarian Split Squat', 3, '8-10', 'RPE 8', 16], ['Leg Extension', 3, '12-15', 'RPE 9', 40], ['Lying Leg Curl', 3, '10-12', 'RPE 9', 30], ['Plank', 3, '45s', '', 0]] },
  ],
} as const;

/** Per-week metrics for each behaviour pattern. w = 0 (oldest) .. weeks-1 (latest) */
function weekMetrics(p: Pattern, w: number, weeks: number) {
  const late = w >= weeks - 3; // last three weeks
  const base = { train: 90, nutr: 85, energy: 7, stress: 4, sleepQ: 7, sleepH: 7.3, hunger: 5, steps: 9500, trend: -0.45 };
  switch (p) {
    case 'star': return { ...base, train: 95, nutr: 90, energy: 8, trend: -0.55 };
    case 'steady': return { ...base, train: 85, nutr: 75, trend: -0.25 };
    case 'drifting': return late ? { ...base, train: 90 - (w - (weeks - 4)) * 18, nutr: 85 - (w - (weeks - 4)) * 15, energy: 4, stress: 8, sleepQ: 4, sleepH: 6.1, steps: 5200, trend: 0.3 } : base;
    case 'ghost': return late ? { ...base, train: 40, nutr: 35, energy: 4, stress: 7, sleepQ: 5, steps: 4000, trend: 0.4 } : { ...base, train: 75, nutr: 65, trend: -0.2 };
    case 'overdue': return late ? { ...base, train: 60, nutr: 55, energy: 5, stress: 7, trend: 0.1 } : { ...base, train: 85, nutr: 80, trend: -0.2 };
    case 'renewal': return late ? { ...base, train: 55, nutr: 50, energy: 5, stress: 8, sleepQ: 4, sleepH: 5.8, trend: 0.2 } : { ...base, train: 85, nutr: 80, trend: -0.5 };
    case 'new': return { ...base, train: 100, nutr: 80, energy: 7, trend: 0.2 };
  }
}

const WINS = ['Hit every session this week', 'New PB on hip thrust', 'Meal prepped Sunday and it made the week so easy', 'Stuck to my steps every day', 'Didn\'t snack at night once', 'Felt strong in the gym', 'Clothes fitting better', 'Got 7+ hours sleep most nights'];
const STRUGGLES = ['Weekend meals out', 'Work was manic so sleep suffered', 'Hungry in the evenings', 'Missed one session with a cold', 'Struggling to hit protein', 'Low motivation midweek'];
const STRUGGLES_BAD = ['Honestly a rough week, work is crazy and I\'ve barely trained', 'Not feeling it at the moment, everything is slipping', 'Stressed and eating badly, sorry', 'Haven\'t been sleeping and skipped most sessions'];

export async function seedDemo(client: SupabaseClient, opts: { coachEmail?: string; clientEmail?: string; password?: string } = {}) {
  admin = client;
  seed = 42;
  COACH_EMAIL = opts.coachEmail || process.env.DEMO_COACH_EMAIL || 'demo@coachos.app';
  CLIENT_EMAIL = opts.clientEmail || process.env.DEMO_CLIENT_EMAIL || 'client@coachos.app';
  PASSWORD = opts.password || process.env.DEMO_PASSWORD || 'DemoCoach2026!';
  log('Resetting demo data…');
  for (const email of [CLIENT_EMAIL, COACH_EMAIL]) {
    const u = await findUser(email);
    if (u) {
      if (email === COACH_EMAIL) {
        const { data: oldClients } = await admin.from('clients').select('id, user_id').eq('coach_id', u.id);
        const { data: photos } = await admin.from('progress_photos').select('storage_path').in('client_id', (oldClients ?? []).map((c) => c.id));
        if (photos?.length) await admin.storage.from('progress-photos').remove(photos.map((p) => p.storage_path));
      }
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  // Coach
  const { data: coachUser, error: cuErr } = await admin.auth.admin.createUser({
    email: COACH_EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { role: 'coach', full_name: 'Sam Fletcher', business_name: 'Strong North Coaching' },
  });
  if (cuErr || !coachUser.user) throw cuErr ?? new Error('coach not created');
  const coachId = coachUser.user.id;
  await must(admin.from('coaches').update({
    plan: 'pro', client_limit: 1000, subscription_status: 'active', trial_ends_at: new Date(Date.now() + 3650 * DAY).toISOString(),
    checkin_day: 0, email_digest: false,
    ai_voice_notes: "Warm, direct and upbeat. Short paragraphs. Use their first name. Celebrate one specific win, be honest about adherence, give 1-2 clear actions. Sign off '- Sam'.",
    checkin_questions: [{ id: 'q1', label: 'How was your digestion this week?', type: 'text' }, { id: 'q2', label: 'Anything coming up next week (holidays, events, busy work)?', type: 'text' }],
    checkin_measurements: ['waist', 'hips'],
  }).eq('id', coachId).select('id'), 'update coach');

  // Exercise lookup
  const exRows = await must(admin.from('exercises').select('id, name').is('coach_id', null), 'exercises');
  const exId = new Map((exRows as { id: string; name: string }[]).map((e) => [e.name, e.id] as [string, string]));
  const need = (n: string) => { const id = exId.get(n); if (!id) throw new Error(`Exercise missing from library: ${n}. Run migration 0002 first.`); return id; };
  // A custom coach exercise with a demo video
  await admin.from('exercises').insert({ coach_id: coachId, name: 'Banded Glute Walk (Sam\'s cue)', muscle_group: 'Glutes', equipment: 'Band', instructions: 'Stay low, toes forward, push knees out against the band.', video_url: 'https://www.youtube.com/' });

  // Template programme
  async function buildProgram(clientId: string | null, active = true) {
    const prog = await must(admin.from('programs').insert({ coach_id: coachId, client_id: clientId, name: TEMPLATE.name, description: TEMPLATE.description, is_active: active }).select('id').single(), 'program');
    const workouts: { id: string; name: string; ex: { weId: string; exId: string; name: string; sets: number; startKg: number }[] }[] = [];
    for (const [i, d] of TEMPLATE.days.entries()) {
      const w = await must(admin.from('workouts').insert({ program_id: prog.id, name: d.name, position: i }).select('id').single(), 'workout');
      const rows = d.ex.map(([name, sets, reps, target], j) => ({ workout_id: w.id, exercise_id: need(name), position: j, sets, reps, target: target || null, rest_seconds: j < 2 ? 150 : 90 }));
      const inserted = await must(admin.from('workout_exercises').insert(rows).select('id, exercise_id, position'), 'workout exercises');
      workouts.push({ id: w.id, name: d.name, ex: (inserted as { id: string; exercise_id: string; position: number }[]).sort((a, b) => a.position - b.position).map((r, j) => ({ weId: r.id, exId: r.exercise_id, name: d.ex[j][0], sets: d.ex[j][1], startKg: d.ex[j][4] })) });
    }
    return { id: prog.id, workouts };
  }
  await buildProgram(null);

  const today = new Date();
  const lastSunday = new Date(today.getTime() - today.getDay() * DAY);
  lastSunday.setHours(9, 30, 0, 0);
  if (lastSunday.getTime() > Date.now()) lastSunday.setTime(lastSunday.getTime() - 7 * DAY);

  let clientUserId: string | null = null;
  const clientIds: string[] = [];

  for (const p of PEOPLE) {
    const weeks = p.pattern === 'new' ? 3 : Math.min(9, Math.floor(p.months * 4.3));
    const client = await must(admin.from('clients').insert({
      coach_id: coachId, full_name: p.name, email: `${p.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      status: 'active', goal: p.goal, monthly_fee: p.fee, renewal_date: dateOnly(p.renewalIn),
      target_weight_kg: /lose|drop|cut|lean/i.test(p.goal) ? Math.round(p.startWeight - 6) : null,
      phone: '07700 900' + String(100 + clientIds.length * 7).slice(-3),
      payment_status: p.pattern === 'overdue' ? 'overdue' : p.renewalIn <= 7 && p.renewalIn >= 0 ? 'due' : 'paid',
      start_date: new Date(Date.now() - Math.max(p.months * 30, weeks * 7 + 3) * DAY).toISOString().slice(0, 10),
      health_consent_at: iso(weeks * 7 * DAY),
      onboarding: {
        age: String(clamp(jitter(31, 7), 22, 45)), height_cm: String(clamp(jitter(172, 9), 158, 190)), starting_weight_kg: String(p.startWeight),
        main_goal: p.goal, training_experience: rand() > 0.5 ? '2 years, mostly machines' : 'On and off for 5 years',
        training_days_per_week: '4', equipment: 'Full gym', injuries: rand() > 0.7 ? 'Old left knee niggle, fine with warm-up' : 'None',
        diet: 'No restrictions. Struggle with weekends.', lifestyle: 'Office job, 7,000 steps on average, 6.5h sleep', why_now: 'Ready to actually be consistent and see it through.',
      },
    }).select('id').single(), `client ${p.name}`);
    clientIds.push(client.id);

    if (p.login) {
      const { data: cu, error } = await admin.auth.admin.createUser({ email: CLIENT_EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { role: 'client', full_name: p.name } });
      if (error || !cu.user) throw error ?? new Error('client user not created');
      clientUserId = cu.user.id;
      await admin.from('clients').update({ user_id: clientUserId }).eq('id', client.id);
    }

    const prog = await buildProgram(client.id);
    await admin.from('nutrition_targets').insert({
      client_id: client.id, calories: clamp(p.startWeight * 26, 1500, 2900), protein_g: clamp(p.startWeight * 2, 100, 210),
      carbs_g: clamp(p.startWeight * 2.6, 140, 330), fat_g: clamp(p.startWeight * 0.8, 45, 90), water_l: 3,
      habits: ['8,000+ steps daily', '7+ hours sleep', 'Protein at every meal', 'Two portions of veg at lunch and dinner'],
      notes: 'Keep weekends within 300kcal of target. Log on the app every day for the first month.',
    });

    // Weekly history
    let weight = p.startWeight;
    const ghostCutoff = p.pattern === 'ghost' ? 2 : 0; // weeks with no check-in at the end
    let kgBoost = 0;
    for (let w = 0; w < weeks; w++) {
      const m = weekMetrics(p.pattern, w, weeks);
      weight = r1(weight + jitter(m.trend, 0.25));
      const sunday = new Date(lastSunday.getTime() - (weeks - 1 - w) * 7 * DAY);
      const isLatest = w === weeks - 1;
      const skipCheckin = w >= weeks - ghostCutoff;

      // Workouts this week
      const sessions = Math.max(0, Math.round((m.train / 100) * 4 * jitter(1, 0.08)));
      const doSessions = p.pattern === 'ghost' && w >= weeks - 2 ? 0 : p.pattern === 'drifting' && w === weeks - 1 ? 0 : sessions;
      for (let s = 0; s < Math.min(doSessions, 4); s++) {
        const wk = prog.workouts[s % prog.workouts.length];
        const when = new Date(sunday.getTime() - (6 - s * 1.6) * DAY + 18 * 3_600_000);
        if (when.getTime() > Date.now()) continue;
        const log = await must(admin.from('workout_logs').insert({ client_id: client.id, workout_id: wk.id, workout_name: wk.name, completed_at: when.toISOString(), session_rpe: clamp(jitter(8, 1), 6, 10) }).select('id').single(), 'log');
        const sets = wk.ex.flatMap((e) => Array.from({ length: e.sets }, (_, k) => ({
          workout_log_id: log.id, exercise_id: e.exId, exercise_name: e.name, set_number: k + 1,
          reps: clamp(jitter(9, 2), 5, 15), weight_kg: e.startKg ? r1(e.startKg * (p.pattern === 'new' ? 0.8 : 1) + kgBoost * (e.startKg > 40 ? 2.5 : 1)) : null,
        })));
        await admin.from('set_logs').insert(sets);
      }
      kgBoost += m.train > 70 ? 1 : 0;

      if (skipCheckin) continue;
      const bad = m.train < 60;
      const pendingNow = isLatest && !!p.pending;
      const checkin = {
        client_id: client.id, coach_id: coachId, submitted_at: sunday.toISOString(),
        weight_kg: weight, waist_cm: r1(p.startWeight * 1.0 + (weight - p.startWeight) * 0.9 + jitter(0, 0.4)),
        hips_cm: r1(p.startWeight * 1.25 + (weight - p.startWeight) * 0.7 + jitter(0, 0.4)),
        sleep_hours: r1(jitter(m.sleepH, 0.3)), sleep_quality: clamp(jitter(m.sleepQ, 1), 1, 10), energy: clamp(jitter(m.energy, 1), 1, 10),
        stress: clamp(jitter(m.stress, 1), 1, 10), hunger: clamp(jitter(m.hunger, 1.5), 1, 10),
        training_adherence: clamp(m.train / 10, 0, 10) * 10, nutrition_adherence: clamp(m.nutr / 10, 0, 10) * 10,
        avg_steps: clamp(jitter(m.steps, 900), 2000, 16000),
        wins: bad ? 'Got one session in at least' : WINS[Math.floor(rand() * WINS.length)],
        struggles: bad ? STRUGGLES_BAD[Math.floor(rand() * STRUGGLES_BAD.length)] : STRUGGLES[Math.floor(rand() * STRUGGLES.length)],
        questions: isLatest && p.pattern === 'star' ? 'Can I swap Romanian deadlifts for something else? My lower back feels a bit tight after them.' : null,
        custom_answers: { q1: bad ? 'Bloated most days' : 'All good', q2: isLatest && p.pattern === 'renewal' ? 'Not sure I can keep going after this month, money is tight' : 'Nothing major' },
        status: pendingNow ? 'submitted' : 'reviewed',
        coach_reply: pendingNow ? null : `Great work this week ${p.name.split(' ')[0]}. ${bad ? "I know it's been tough. Let's simplify: 3 sessions and hit protein, that's it." : 'Keep doing exactly what you\'re doing.'}\n\n- Sam`,
        replied_at: pendingNow ? null : new Date(sunday.getTime() + 26 * 3_600_000).toISOString(),
        ai_analysis: pendingNow ? aiFor(p, { train: clamp(m.train / 10, 0, 10) * 10, nutr: clamp(m.nutr / 10, 0, 10) * 10 }) : null,
      };
      await must(admin.from('checkins').insert(checkin).select('id'), 'checkin');
    }

    // Messages
    const msgs = [
      { sender: 'coach', body: `Welcome aboard ${p.name.split(' ')[0]}! Your programme is in the app. Any questions just message me here.`, at: (weeks * 7 - 1) * DAY },
      { sender: 'client', body: 'Thanks Sam, first session done. Legs are already sore!', at: (weeks * 7 - 3) * DAY },
    ];
    if (p.pattern === 'overdue' || p.pattern === 'renewal') msgs.push({ sender: 'client', body: p.pattern === 'renewal' ? 'Is there a cheaper option if I need to cut back for a bit?' : 'Sorry, will sort payment this week.', at: 12 * DAY });
    if (p.pattern === 'drifting') msgs.push({ sender: 'client', body: 'Sorry, been a mad couple of weeks at work. Will try to get back on it.', at: 16 * DAY });
    if (!['ghost', 'drifting', 'overdue', 'renewal'].includes(p.pattern)) {
      msgs.push({ sender: 'client', body: ['Quick one: is it ok to train fasted in the morning?', 'Smashed legs today!', 'Can I swap Thursday\'s session to Friday this week?', 'Feeling great this week, thanks Sam'][Math.floor(rand() * 4)], at: clamp(jitter(4, 2), 1, 7) * DAY });
      msgs.push({ sender: 'coach', body: 'Yes, no problem at all. Keep me posted!', at: clamp(jitter(3, 1), 0, 6) * DAY });
    }
    if (p.pattern === 'star' && p.login) msgs.push({ sender: 'coach', body: 'Down 3.8kg since you started. Brilliant consistency. Keep it up!', at: 2 * DAY });
    for (const m of msgs) {
      await admin.from('messages').insert({ client_id: client.id, coach_id: coachId, sender: m.sender, body: m.body, created_at: iso(m.at), read_at: iso(m.at - 3_600_000) });
    }
    log(`  ✓ ${p.name} (${p.pattern})`);
  }

  // One invited client who hasn't joined yet
  const inv = await must(admin.from('clients').insert({ coach_id: coachId, full_name: 'Sam Patel', email: 'sam.patel@example.com', status: 'invited', goal: 'Lose 7kg', monthly_fee: 140, renewal_date: dateOnly(30) }).select('id').single(), 'invited client');
  await admin.from('invites').insert({ client_id: inv.id, coach_id: coachId, email: 'sam.patel@example.com' });

  // Risk scores
  for (const id of clientIds) await recomputeRisk(admin, id);

  return { coachEmail: COACH_EMAIL, clientEmail: CLIENT_EMAIL, password: PASSWORD, clients: clientIds.length + 1 };
  log(`\nDemo ready.
  Coach:  ${COACH_EMAIL} / ${PASSWORD}   → /coach
  Client: ${CLIENT_EMAIL} / ${PASSWORD}   → /app (Emma Walsh)\n`);
}

/** Pre-written AI analyses so the demo works without an Anthropic API key. Re-run analysis live on the call to show the real thing. */
function aiFor(p: Persona, latest: { train: number; nutr: number }) {
  const first = p.name.split(' ')[0];
  const base = { model: 'demo', generated_at: new Date().toISOString() };
  if (p.pending === 'declining') return {
    ...base, engagement: 'declining',
    summary: `${first}'s adherence has fallen for three weeks running, down to ${latest.train}% training and ${latest.nutr}% nutrition this week. His weight has stalled and started creeping up, stress is high and sleep is down to about 6 hours. He mentions work pressure. This is a classic early drop-off pattern, and his renewal is in 9 days.`,
    changes: ['Training adherence down for 3 consecutive weeks', 'Nutrition adherence down for 3 consecutive weeks', 'Weight trending back up after 6 weeks of steady loss', 'Average steps roughly halved', 'Sleep down about an hour a night, stress at 8/10'],
    concerns: ['Possible early disengagement. Renewal falls in 9 days', 'Reports bloating most days. Worth asking about food choices and stress'],
    suggestions: ['Consider a lighter "maintenance" fortnight: 3 sessions and a protein target only', 'A short call before the renewal date could help more than a written reply'],
    investigate: ['What has changed at work, and is it temporary?', 'Would a 3-session minimum week feel more doable for the next fortnight?', 'Is the evening eating driven by stress or hunger?'],
    draft_reply: `Hey ${first}, thanks for being honest. I can see work has been brutal and that's had a knock-on effect on sleep, training and food, which is completely normal.\n\nThe 6 weeks before this are proof you can do it, and nothing is lost. For the next two weeks, let's go into "maintenance mode":\n\n1. 3 sessions a week. Upper A, Lower A and one more if you can.\n2. Just hit your protein (190g). Don't worry about perfect calories.\n\nCan we do a quick 10-minute chat this week to plan around your work schedule?\n\n- Sam`,
  };
  if (p.pending === 'improving') return {
    ...base, engagement: 'improving',
    summary: `Another excellent week for ${first}: ${latest.train}% training, ${latest.nutr}% nutrition and a further drop in weight and waist. Energy and sleep are good. She's asking to swap Romanian deadlifts due to lower-back tightness.`,
    changes: ['Weight down again, consistent ~0.5kg/week trend', 'Waist down 0.6cm', 'Hip thrust up 5kg on last week', 'Energy steady at 8/10'],
    concerns: ['Lower-back tightness after Romanian deadlifts. Check technique and load before swapping; refer on if it persists or is painful'],
    suggestions: ['Consider reducing RDL load while you check her form', 'You could swap to back extensions if the tightness continues'],
    investigate: ['Ask for a form video of her RDL', 'Is the tightness muscular fatigue or pain?'],
    draft_reply: `${first}, this is a brilliant week. Another 0.5kg down, your waist keeps coming in, and that hip thrust PB is a big deal. You're right on track for May.\n\nOn the RDLs: tightness can just be your hamstrings and back working hard, but let's be safe. Send me a quick side-on video of your next set and drop the weight by 10kg for now. If it still feels off, we'll swap to a 45-degree back extension.\n\nKeep doing exactly what you're doing!\n\n- Sam`,
  };
  return {
    ...base, engagement: 'stable',
    summary: `Solid, steady week for ${first}. Training ${latest.train}%, nutrition ${latest.nutr}%, weight roughly stable. Weekends remain the main barrier to faster progress.`,
    changes: ['Weight roughly flat (±0.2kg)', 'Strength creeping up on hip thrust and split squats'],
    concerns: [],
    investigate: ['What does a typical weekend look like? Could she plan one meal out instead of the whole day?'],
    draft_reply: `Nice steady week ${first}. 4 sessions done and your hip thrust keeps climbing, which is exactly what we want for your glute goals.\n\nWeight is flat, and I think weekends are where the difference is. This weekend, try picking ONE meal out to enjoy fully and keep the rest of the day on plan. Let me know how it goes.\n\n- Sam`,
  };
}

