import { createAdminClient } from '@/lib/supabase/server';
import { acceptInvite } from './actions';
import { SubmitButton } from '@/components/submit-button';

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: invite } = await admin.from('invites')
    .select('email, accepted_at, expires_at, clients(full_name), coaches(business_name, profiles(full_name))')
    .eq('token', token).single();

  const valid = invite && !invite.accepted_at && new Date(invite.expires_at) > new Date();
  const coach = invite?.coaches as unknown as { business_name: string | null; profiles: { full_name: string | null } | null } | null;
  const coachName = coach?.business_name || coach?.profiles?.full_name || 'your coach';
  const clientName = (invite?.clients as unknown as { full_name: string } | null)?.full_name;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        {!valid ? (
          <>
            <h1>Invite not valid</h1>
            <p className="text-sm text-slate-600">This link has expired or has already been used. Ask your coach to send a new one, or <a className="link" href="/login">log in</a>.</p>
          </>
        ) : (
          <form action={acceptInvite} className="space-y-4">
            <h1>Hi {clientName?.split(' ')[0]}</h1>
            <p className="text-sm text-slate-600"><strong>{coachName}</strong> has invited you to your coaching app. Create a password to get started.</p>
            {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
            <input type="hidden" name="token" value={token} />
            <label className="block"><span className="label">Email</span><input value={invite.email} disabled className="input bg-slate-100" /></label>
            <label className="block"><span className="label">Create a password (8+ characters)</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
            <SubmitButton className="btn-primary w-full" pendingText="Setting up…">Create my account</SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
