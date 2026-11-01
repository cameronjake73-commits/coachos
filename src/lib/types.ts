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
  created_at: string;
}

export interface Checkin {
  id: string;
  client_id: string;
  coach_id: string;
  submitted_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
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
  checkin_questions: { id: string; label: string }[];
  email_digest: boolean;
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
