import { requireCoach } from '@/lib/auth';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui';
import { BroadcastForm, type Audience } from '@/components/broadcast-form';
import { sendBroadcast } from '../../clients/actions';
import { broadcastAudience } from '@/lib/broadcast';

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ error?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach, user } = await requireCoach();
  const [clients, { data: me }] = await Promise.all([
    broadcastAudience(supabase, coach.id, coach.checkin_day),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);
  const initial = (['active', 'attention', 'missed', 'pick'] as Audience[]).includes(sp.to as Audience) ? (sp.to as Audience) : 'active';
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Message several clients" back={{ href: '/coach/messages', label: 'Messages' }}
        description="Each client gets it as a private message in their app, so replies come back to you one-to-one." />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      <Card>
        {clients.length === 0
          ? <EmptyState icon="clients" title="No active clients yet">Clients appear here once they’ve accepted their invite.</EmptyState>
          : <BroadcastForm action={sendBroadcast} clients={clients} coachFirst={(me?.full_name || 'Coach').split(' ')[0]} initialAudience={initial} />}
      </Card>
    </div>
  );
}
