import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Card, PageHeader } from '@/components/ui';
import { ImportWizard } from '@/components/import-wizard';
import { importClients } from '../actions';
import { isUnlimited } from '@/lib/plans';

export default async function ImportClientsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { data } = await supabase.from('clients').select('email, status').eq('coach_id', coach.id);
  const used = (data ?? []).filter((c) => c.status !== 'archived').length;
  const placesLeft = Math.max(0, coach.client_limit - used);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Import clients" back={{ href: '/coach/clients', label: 'Clients' }}
        description="Bring your whole client list over in one go. Each client gets an invite link to set up their app." />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      {placesLeft === 0 && <Alert tone="amber" title="No client places left" action={<Link href="/coach/billing" className="btn-secondary btn-sm">Upgrade</Link>}>Upgrade your plan or archive clients to import more.</Alert>}
      <Card>
        <ImportWizard action={importClients} existingEmails={(data ?? []).map((c) => c.email)} placesLeft={placesLeft} />
      </Card>
      <p className="text-center text-xs text-slate-500">{isUnlimited(coach.client_limit) ? 'Unlimited clients on your plan.' : `${placesLeft} of ${coach.client_limit} client places free.`} Only name and email are required. Clients you import start as “Invited” until they accept.</p>
    </div>
  );
}
