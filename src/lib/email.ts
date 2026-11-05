/**
 * Transactional email via Resend (https://resend.com) using plain fetch.
 * If RESEND_API_KEY is not set, emails are skipped (logged) so the app still works.
 */
const APP = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'COACHOS <onboarding@resend.dev>'; // resend.dev only delivers to your own Resend login email: set EMAIL_FROM once your domain is verified
  if (!key) { console.info(`[email skipped: no RESEND_API_KEY] to=${to} subject=${subject}`); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error('email failed', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('email error', e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(title: string, body: string, cta?: { label: string; url: string }, footer = '') {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
  <tr><td>
    <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#334155">${body}</div>
    ${cta ? `<p style="margin:24px 0 8px"><a href="${cta.url}" style="background:#6a46f5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : ''}
  </td></tr></table>
  <p style="font-size:12px;color:#94a3b8;margin-top:16px">${footer || 'Sent by COACHOS on behalf of your coach.'}</p>
  </td></tr></table></body></html>`;
}

export const emails = {
  invite: (p: { clientName: string; coachName: string; token: string }) => ({
    subject: `${p.coachName} has invited you to your coaching app`,
    html: layout(`Hi ${p.clientName.split(' ')[0]}`,
      `<p><strong>${esc(p.coachName)}</strong> has set up your coaching app. You'll find your workouts, weekly check-ins, progress and messages with your coach there.</p><p>Tap below to create your password. The link expires in 14 days.</p>`,
      { label: 'Set up my account', url: `${APP()}/invite/${p.token}` }),
  }),
  checkinReminder: (p: { clientName: string; coachName: string }) => ({
    subject: 'Your weekly check-in is due',
    html: layout(`Check-in time, ${p.clientName.split(' ')[0]}`,
      `<p>It's check-in day. It takes about 3 minutes and lets ${esc(p.coachName)} adjust your plan for next week.</p>`,
      { label: 'Submit my check-in', url: `${APP()}/app/checkin` }),
  }),
  coachReplied: (p: { clientName: string; coachName: string }) => ({
    subject: `${p.coachName} replied to your check-in`,
    html: layout(`New feedback for you`, `<p>Hi ${esc(p.clientName.split(' ')[0])}, ${esc(p.coachName)} has reviewed your check-in and left feedback.</p>`,
      { label: 'Read feedback', url: `${APP()}/app/messages` }),
  }),
  newMessage: (p: { toName: string; fromName: string; forCoach: boolean; clientId?: string }) => ({
    subject: `New message from ${p.fromName}`,
    html: layout(`New message`, `<p>Hi ${esc(p.toName.split(' ')[0])}, you have a new message from ${esc(p.fromName)}.</p>`,
      { label: 'Open messages', url: p.forCoach ? `${APP()}/coach/clients/${p.clientId}?tab=messages` : `${APP()}/app/messages` }),
  }),
  coachDigest: (p: { coachName: string; pending: number; atRisk: { name: string; reason: string }[]; overdue: number; unread?: number }) => {
    const parts = [
      p.pending ? `${p.pending} check-in${p.pending === 1 ? '' : 's'} to review` : '',
      p.unread ? `${p.unread} unread message${p.unread === 1 ? '' : 's'}` : '',
      p.atRisk.length ? `${p.atRisk.length} client${p.atRisk.length === 1 ? ' needs' : 's need'} you` : '',
    ].filter(Boolean);
    return {
    subject: parts.join(' · ') || 'Your COACHOS summary',
    html: layout(`Good morning ${p.coachName.split(' ')[0]}`,
      `<p><strong>${p.pending}</strong> check-in${p.pending === 1 ? '' : 's'} waiting for review${p.overdue ? ` and <strong>${p.overdue}</strong> overdue` : ''}.</p>
       ${p.unread ? `<p><strong>${p.unread}</strong> unread message${p.unread === 1 ? '' : 's'} from clients, including any sent outside your working hours.</p>` : ''}
       ${p.atRisk.length ? `<p style="margin-bottom:4px"><strong>Clients at risk:</strong></p><ul style="padding-left:18px;margin-top:0">${p.atRisk.slice(0, 8).map((c) => `<li>${esc(c.name)}: ${esc(c.reason)}</li>`).join('')}</ul>` : ''}`,
      { label: 'Open dashboard', url: `${APP()}/coach` }, 'Your daily COACHOS summary.'),
    };
  },
};
