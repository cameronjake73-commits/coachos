export type RiskLevel = 'low' | 'medium' | 'high';
export type PaymentStatus = 'paid' | 'due' | 'overdue' | 'cancelled';

export interface Client {
  id: string;
  coach_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  status: 'invited' | 'active' | 'paused' | 'archived';
  goal: string | null;
  start_date: string | null;
  monthly_fee: number | null;
  renewal_date: string | null;
  payment_status: PaymentStatus;
  notes: string | null;
  onboarding: Record<string, string>;
  health_consent_at: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
  risk_updated_at: string | null;
  email_reminders: boolean;
  phone: string | null;
  target_weight_kg: number | null;
  goal_deadline: string | null;
  archived_at: string | null;
  ai_summary: AiClientSummary | null;
  ai_draft: string | null;
  ai_draft_at: string | null;
  created_at: string;
}

export interface AiClientSummary {
  summary: string;
  observations: string[];
  suggestions: string[];
  model: string;
  generated_at: string;
}

export type QuestionType = 'text' | 'scale' | 'yesno';
export interface CheckinQuestion { id: string; label: string; type?: QuestionType }
export const MEASUREMENTS = [
  { key: 'waist_cm', id: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'chest_cm', id: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'hips_cm', id: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'arm_cm', id: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh_cm', id: 'thigh', label: 'Thigh', unit: 'cm' },
  { key: 'body_fat_pct', id: 'body_fat', label: 'Body fat', unit: '%' },
] as const;

export interface Checkin {
  id: string;
  client_id: string;
  coach_id: string;
  submitted_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  stress: number | null;
  hunger: number | null;
  training_adherence: number | null;
  nutrition_adherence: number | null;
  avg_steps: number | null;
  wins: string | null;
  struggles: string | null;
  questions: string | null;
  custom_answers: Record<string, string>;
  status: 'submitted' | 'reviewed';
  ai_analysis: AiAnalysis | null;
  coach_reply: string | null;
  replied_at: string | null;
}

export interface AiAnalysis {
  summary: string;
  /** Facts taken directly from the data (older analyses called these "changes"). */
  observations?: string[];
  /** Ideas for the coach to consider. The coach decides. */
  suggestions?: string[];
  changes: string[];
  concerns: string[];
  investigate: string[];
  engagement: 'improving' | 'stable' | 'declining';
  draft_reply: string;
  model: string;
  generated_at: string;
}

export interface Coach {
  id: string;
  business_name: string | null;
  plan: 'trial' | 'starter' | 'growth' | 'pro';
  client_limit: number;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string;
  ai_voice_notes: string | null;
  checkin_day: number;
  checkin_questions: CheckinQuestion[];
  checkin_measurements: string[];
  email_digest: boolean;
  ai_brief: AiBrief | null;
  // Working hours & boundaries (migration 0006; may be missing on older databases)
  hours_enabled?: boolean;
  hours_days?: number[];
  hours_start?: string;
  hours_end?: string;
  reply_within_hours?: number;
  auto_reply_enabled?: boolean;
  auto_reply_text?: string | null;
  quick_replies?: { title: string; body: string }[];
}

export interface Exercise {
  id: string;
  coach_id: string | null;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  instructions: string | null;
  video_url: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: string;
  target: string | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises?: Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'video_url' | 'instructions'>;
}

export interface Workout {
  id: string;
  program_id: string;
  name: string;
  position: number;
  notes: string | null;
  workout_exercises?: WorkoutExercise[];
}

export interface AiBrief {
  headline: string;
  priorities: { client_id: string; name: string; observation: string; suggestion: string }[];
  model: string;
  generated_at: string;
}
