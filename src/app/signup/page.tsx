import Link from 'next/link';
import { redirectIfSignedIn } from '@/lib/auth';
import { signupCoach } from '../login/actions';
import { SubmitButton } from '@/components/submit-button';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await redirectIfSignedIn();
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={signupCoach} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        <h1>Start your 14-day trial</h1>
        {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
        <label className="block"><span className="label">Your name</span><input name="full_name" required className="input" /></label>
        <label className="block"><span className="label">Coaching business name</span><input name="business_name" className="input" placeholder="e.g. Strong North Coaching" /></label>
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
        <label className="block"><span className="label">Password (8+ characters)</span><input name="password" type="password" minLength={8} required className="input" /></label>
        <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create coach account</SubmitButton>
        <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" name="terms" required className="mt-0.5" />
          <span>I agree to the <Link href="/terms" className="link" target="_blank">Terms</Link> and <Link href="/privacy" className="link" target="_blank">Privacy Policy</Link>, including the data processing terms for my clients&apos; data.</span></label>
        <p className="text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="link">Log in</Link></p>
      </form>
    </main>
  );
}
