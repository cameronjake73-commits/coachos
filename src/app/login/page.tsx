import Link from 'next/link';
import { redirectIfSignedIn } from '@/lib/auth';
import { login } from './actions';
import { SubmitButton } from '@/components/submit-button';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  await redirectIfSignedIn();
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        <h1>Log in</h1>
        {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
        {sp.message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.message}</p>}
        <input type="hidden" name="next" value={sp.next || ''} />
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
        <label className="block"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
        <div className="text-right text-sm"><Link href="/forgot-password" className="link">Forgot password?</Link></div>
        <SubmitButton className="btn-primary w-full" pendingText="Logging in…">Log in</SubmitButton>
        <p className="text-center text-sm text-slate-600">Coach without an account? <Link href="/signup" className="link">Start a free trial</Link></p>
      </form>
    </main>
  );
}
