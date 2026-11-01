import Link from 'next/link';
import { requestPasswordReset } from '../login/actions';
import { SubmitButton } from '@/components/submit-button';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={requestPasswordReset} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        <h1>Reset your password</h1>
        {sp.sent ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">If an account exists for that email, we&apos;ve sent a reset link. Check your inbox and spam folder.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">Enter your email and we&apos;ll send you a link to set a new password.</p>
            <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
            <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
          </>
        )}
        <p className="text-center text-sm"><Link href="/login" className="link">Back to log in</Link></p>
      </form>
    </main>
  );
}
