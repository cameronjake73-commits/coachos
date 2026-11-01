import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { setNewPassword } from '../login/actions';
import { SubmitButton } from '@/components/submit-button';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        <h1>Choose a new password</h1>
        {!user ? (
          <p className="text-sm text-slate-600">This reset link has expired or was opened in a different browser. <Link href="/forgot-password" className="link">Request a new one</Link>.</p>
        ) : (
          <form action={setNewPassword} className="space-y-4">
            {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
            <label className="block"><span className="label">New password (8+ characters)</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
            <label className="block"><span className="label">Confirm password</span><input name="confirm" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
            <SubmitButton className="btn-primary w-full" pendingText="Saving…">Save password</SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
