import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AiAnalysis, Checkin } from '@/lib/types';

const AnalysisSchema = z.object({
  summary: z.string(),
  changes: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  investigate: z.array(z.string()).default([]),
  engagement: z.enum(['improving', 'stable', 'declining']).default('stable'),
  draft_reply: z.string(),
});

const FIELDS: (keyof Checkin)[] = [
  'submitted_at', 'weight_kg', 'waist_cm', 'sleep_hours', 'sleep_quality', 'energy', 'stress', 'hunger',
  'training_adherence', 'nutrition_adherence', 'avg_steps', 'wins', 'struggles', 'questions', 'custom_answers',
];

function slim(c: Checkin) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) if (c[f] != null && c[f] !== '') out[f] = c[f];
  return out;
}

export interface AnalyzeInput {
  firstName: string;           // first name only — no surname/email sent to the AI provider
  goal: string | null;
  current: Checkin;
  previous: Checkin[];         // newest first, up to 4
  workoutsLast14Days: number;
  plannedPerWeek: number;
  coachVoice: string | null;
  recentCoachReplies: string[];
  customQuestionLabels: Record<string, string>;
}

const SYSTEM = `You are an assistant to a professional online fitness coach. You analyse a client's weekly check-in
and prepare material for the COACH to review. The coach makes every coaching decision and approves anything sent.

Rules:
- Only state facts present in the data. Never invent numbers, events or progress.
- Compare this week with previous weeks and call out meaningful changes (weight trend, adherence, energy, sleep, stress).
- Flag declining engagement, missed workouts and possible obstacles.
- You are not a doctor. If the client mentions pain, injury, illness, medication, disordered eating or mental-health
  concerns, list it under "concerns" and suggest the coach follow up personally / refer to a professional. Do not diagnose.
- The draft reply is written AS the coach, to the client, warm and specific, 80-180 words, British English.
  It should acknowledge one specific win, address the main struggle, give at most 2 clear actions for next week,
  and answer any question only if the answer is general and safe; otherwise say the coach will look into it.

Respond with ONLY a JSON object with keys:
summary (2-3 sentences), changes (string[]), concerns (string[]), investigate (string[] — things the coach should ask or check),
engagement ("improving" | "stable" | "declining"), draft_reply (string).`;

export async function analyzeCheckin(input: AnalyzeInput): Promise<AiAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const anthropic = new Anthropic({ apiKey });

  const payload = {
    client_first_name: input.firstName,
    goal: input.goal,
    custom_question_labels: input.customQuestionLabels,
    this_week: slim(input.current),
    previous_weeks: input.previous.map(slim),
    workouts_logged_last_14_days: input.workoutsLast14Days,
    planned_workouts_per_week: input.plannedPerWeek,
  };

  const voice = [
    input.coachVoice ? `How the coach likes to write: ${input.coachVoice}` : '',
    input.recentCoachReplies.length
      ? `Examples of the coach's previous replies (match tone, length and style):\n${input.recentCoachReplies.map((r, i) => `[${i + 1}] ${r}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: `${voice}\n\nCheck-in data (JSON):\n${JSON.stringify(payload)}` }],
  });

  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = AnalysisSchema.parse(JSON.parse(json));
  return { ...parsed, model, generated_at: new Date().toISOString() };
}
