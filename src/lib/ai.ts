import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AiAnalysis, AiBrief, AiClientSummary, Checkin } from '@/lib/types';

/** True when an Anthropic API key is configured. Every AI feature has a non-AI fallback when this is false. */
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
const model = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

const GROUND_RULES = `You support a professional online fitness coach. The COACH makes every coaching, training,
nutrition and health decision and approves anything sent to a client.
- Use only facts present in the data provided. Never invent numbers, events, dates or progress. If data is missing, say so.
- Keep OBSERVATIONS (what the data shows, with the actual numbers) separate from SUGGESTIONS (ideas for the coach to consider).
- Never prescribe medical, injury, medication or diet-disorder advice. If the data mentions pain, injury, illness, medication,
  disordered eating or mental-health concerns, flag it as a concern for the coach to follow up personally or refer on.
- British English. Plain, specific language. No hype.`;

async function callJson<T>(system: string, user: string, schema: z.ZodType<T>, maxTokens = 1500): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('AI is not connected. Add ANTHROPIC_API_KEY in Vercel to turn it on.');
  const anthropic = new Anthropic({ apiKey });
  const res = await anthropic.messages.create({ model: model(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The AI response was not in the expected format. Try again.');
  return schema.parse(JSON.parse(text.slice(start, end + 1)));
}

const voiceBlock = (voice: string | null, replies: string[]) => [
  voice ? `How the coach likes to write: ${voice}` : '',
  replies.length ? `Examples of the coach's previous messages (match tone, length and style):\n${replies.map((r, i) => `[${i + 1}] ${r}`).join('\n')}` : '',
].filter(Boolean).join('\n\n');

/* ------------------------------------------------------------------ check-in analysis */

const AnalysisSchema = z.object({
  summary: z.string(),
  observations: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  engagement: z.enum(['improving', 'stable', 'declining']).default('stable'),
  draft_reply: z.string(),
});

const FIELDS: (keyof Checkin)[] = [
  'submitted_at', 'weight_kg', 'waist_cm', 'chest_cm', 'hips_cm', 'arm_cm', 'thigh_cm', 'body_fat_pct', 'sleep_hours', 'sleep_quality', 'energy', 'stress', 'hunger',
  'training_adherence', 'nutrition_adherence', 'avg_steps', 'wins', 'struggles', 'questions', 'custom_answers',
];

export function slimCheckin(c: Checkin) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) {
    const v = c[f];
    if (v == null || v === '' || (typeof v === 'object' && !Object.keys(v as object).length)) continue;
    out[f] = v;
  }
  return out;
}

export interface AnalyzeInput {
  firstName: string;           // first name only — no surname/email sent to the AI provider
  goal: string | null;
  targetWeightKg: number | null;
  current: Checkin;
  previous: Checkin[];         // newest first, up to 4
  workoutsInWeek: number;
  plannedPerWeek: number;
  performance: string[];       // e.g. "Squat best set 80kg x 6 (last week 77.5kg x 6)"
  coachVoice: string | null;
  recentCoachReplies: string[];
  customQuestionLabels: Record<string, string>;
}

export async function analyzeCheckin(input: AnalyzeInput): Promise<AiAnalysis> {
  const system = `${GROUND_RULES}

Task: analyse a client's weekly check-in for the coach.
- observations: 3-6 factual points comparing this week with previous weeks (weight trend, measurements, adherence, sleep, energy, stress, workouts done vs planned, performance). Include the numbers.
- suggestions: 1-3 ideas the coach might consider. Phrase as options ("Consider…", "You could…"), never as decisions.
- concerns: anything needing the coach's personal attention (see rules). Empty array if none.
- questions: 1-3 things worth asking the client.
- engagement: improving | stable | declining, judged only from the data.
- draft_reply: written AS the coach TO the client, warm and specific, 80-170 words. Acknowledge one specific win, address the main struggle,
  give at most 2 clear actions for next week. Only answer the client's questions if the answer is general and safe; otherwise say the coach will look into it.
  Do not promise programme or calorie changes; the coach decides those.
Respond with ONLY a JSON object with keys: summary (2 sentences), observations, suggestions, concerns, questions, engagement, draft_reply.`;

  const payload = {
    client_first_name: input.firstName,
    goal: input.goal,
    target_weight_kg: input.targetWeightKg,
    custom_question_labels: input.customQuestionLabels,
    this_week: slimCheckin(input.current),
    previous_weeks_newest_first: input.previous.map(slimCheckin),
    workouts_logged_in_the_7_days_before_this_checkin: input.workoutsInWeek,
    planned_workouts_per_week: input.plannedPerWeek,
    training_performance: input.performance,
  };
  const r = await callJson(system, `${voiceBlock(input.coachVoice, input.recentCoachReplies)}\n\nCheck-in data (JSON):\n${JSON.stringify(payload)}`, AnalysisSchema);
  return {
    summary: r.summary, observations: r.observations, suggestions: r.suggestions, changes: r.observations,
    concerns: r.concerns, investigate: r.questions, engagement: r.engagement, draft_reply: r.draft_reply,
    model: model(), generated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ client progress summary */

const SummarySchema = z.object({ summary: z.string(), observations: z.array(z.string()).default([]), suggestions: z.array(z.string()).default([]) });

export interface ClientSummaryInput {
  firstName: string; goal: string | null; targetWeightKg: number | null; weeksCoached: number;
  checkins: Record<string, unknown>[];   // oldest first, up to 12
  workoutsPerWeek: number[];             // last 8 weeks, oldest first
  plannedPerWeek: number;
  missedCheckins: number;
}

export async function summariseClient(input: ClientSummaryInput): Promise<AiClientSummary> {
  const system = `${GROUND_RULES}

Task: summarise this client's progress for their coach.
- summary: 2-3 sentences on overall progress towards their goal, based only on the data.
- observations: 3-6 factual trends with numbers (start vs now, recent 4 weeks vs earlier, consistency, missed check-ins, training frequency).
- suggestions: 1-3 options for the coach to consider.
Respond with ONLY a JSON object with keys: summary, observations, suggestions.`;
  const r = await callJson(system, `Client data (JSON):\n${JSON.stringify(input)}`, SummarySchema, 1000);
  return { ...r, model: model(), generated_at: new Date().toISOString() };
}

/* ------------------------------------------------------------------ outreach draft */

const DraftSchema = z.object({ message: z.string() });

export interface DraftInput {
  firstName: string; coachFirstName: string; reasons: string[]; lastCheckin: Record<string, unknown> | null;
  daysSinceLastCheckin: number | null; daysSinceLastMessage: number | null; paymentOverdue: boolean;
  coachVoice: string | null; recentCoachMessages: string[];
}

export async function draftMessage(input: DraftInput): Promise<string> {
  const system = `${GROUND_RULES}

Task: draft a short message FROM the coach TO the client to re-engage them. 50-110 words, warm, personal, no guilt-tripping.
Refer only to facts in the data. If payment is overdue, mention it lightly and kindly. End with one easy question they can reply to.
Sign off with the coach's first name. Respond with ONLY a JSON object: {"message": "..."}`;
  const r = await callJson(system, `${voiceBlock(input.coachVoice, input.recentCoachMessages)}\n\nData (JSON):\n${JSON.stringify(input)}`, DraftSchema, 600);
  return r.message.trim();
}

/* ------------------------------------------------------------------ weekly brief */

const BriefSchema = z.object({
  headline: z.string(),
  priorities: z.array(z.object({ client_ref: z.string(), observation: z.string(), suggestion: z.string() })).max(6),
});

export interface BriefInput {
  totals: Record<string, number>;
  clients: { ref: string; first_name: string; facts: string[] }[];   // already ranked by need
}

export async function weeklyBrief(input: BriefInput, refToClient: Map<string, { id: string; name: string }>): Promise<AiBrief> {
  const system = `${GROUND_RULES}

Task: write the coach's weekly priorities brief.
- headline: one sentence summarising the roster this week using the totals.
- priorities: up to 5 clients, most important first. For each: client_ref (exactly as given), observation (what the data shows, with numbers),
  suggestion (one concrete next step for the coach to consider).
Respond with ONLY a JSON object: {"headline": "...", "priorities": [{"client_ref": "...", "observation": "...", "suggestion": "..."}]}`;
  const r = await callJson(system, `Roster data (JSON):\n${JSON.stringify(input)}`, BriefSchema, 1200);
  return {
    headline: r.headline,
    priorities: r.priorities.flatMap((p) => { const c = refToClient.get(p.client_ref); return c ? [{ client_id: c.id, name: c.name, observation: p.observation, suggestion: p.suggestion }] : []; }),
    model: model(), generated_at: new Date().toISOString(),
  };
}
