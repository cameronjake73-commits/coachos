import type { SupabaseClient } from '@supabase/supabase-js';
import { Card } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { Conversation } from '@/components/conversation';
import { generateDraft, sendCoachMessage } from '../../actions';
import { draftOutreach } from '@/lib/dashboard-data';
import { aiEnabled } from '@/lib/ai';
import type { CheckinStatus } from '@/lib/coaching';
import type { Client, Coach } from '@/lib/types';

export async function MessagesTab({ supabase, coach, client, draftMode, status }: { supabase: SupabaseClient; coach: Coach; client: Client; draftMode?: string; status?: CheckinStatus }) {
  const [{ data: msgs }, { data: me }] = await Promise.all([
    supabase.from('messages').select('id, sender, body, created_at, read_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('profiles').select('full_name').eq('id', coach.id).single(),
  ]);
  await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', client.id).eq('sender', 'client').is('read_at', null);
  const ai = aiEnabled();
  const freshAi = client.ai_draft && client.ai_draft_at && Date.now() - new Date(client.ai_draft_at).getTime() < 3 * 86_400_000 ? client.ai_draft : null;
  const draft = draftMode === 'ai' ? freshAi ?? '' : draftMode ? freshAi ?? draftOutreach(client, (me?.full_name || 'Coach').split(' ')[0], status) : '';
  const base = `/coach/clients/${client.id}?tab=messages`;
  const archived = client.status === 'archived';

  return (
    <Card>
      {!draft && <AutoRefresh seconds={15} />}
      <Conversation
        messages={(msgs ?? []).reverse()} me="coach" action={sendCoachMessage}
        hidden={{ client_id: client.id, ...(draft ? { used_draft: '1' } : {}) }}
        draft={draft} placeholder={archived ? 'This client is archived' : `Message ${client.full_name.split(' ')[0]}…`}
        emptyText={`Start the conversation with ${client.full_name.split(' ')[0]}. They'll get it in their app${client.email_reminders ? ' and by email' : ''}.`}
        composerNote={
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {draft ? (
              <span className="flex items-center gap-1.5 text-xs text-brand-100"><Icon name="sparkle" className="h-3.5 w-3.5" />{draftMode === 'ai' || freshAi ? 'AI draft based on their data.' : 'Template draft.'} Edit it so it sounds like you before sending.</span>
            ) : (
              <>
                {ai && (
                  <form action={generateDraft}><input type="hidden" name="client_id" value={client.id} /><input type="hidden" name="back" value={base} />
                    <SubmitButton className="btn-secondary btn-sm" pendingText="Drafting…"><Icon name="sparkle" className="h-3.5 w-3.5" />Draft with AI</SubmitButton></form>
                )}
                <a href={`${base}&draft=1`} className="btn-ghost btn-sm">Use a check-in template</a>
              </>
            )}
          </div>
        }
      />
    </Card>
  );
}
