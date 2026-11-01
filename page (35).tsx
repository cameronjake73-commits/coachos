// TEMPLATE — have this reviewed by a solicitor before launch.
export const metadata = { title: 'Terms of service — COACHOS' };

export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-sm leading-6 text-slate-700">
      <h1 className="text-slate-900">Terms of service</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Template. Replace the bracketed details and get it reviewed before going live.</p>
      <h2 className="text-slate-900">1. About these terms</h2>
      <p>These terms apply between [YOUR NAME / COMPANY] (&quot;we&quot;) and the fitness professional using COACHOS (&quot;you&quot;). Clients invited by you use COACHOS under your coaching agreement with them.</p>
      <h2 className="text-slate-900">2. Subscription and payment</h2>
      <p>Plans are billed monthly in advance through Stripe. Your 14-day free trial needs no card. You can cancel any time from Billing; access continues until the end of the paid period. Fees are non-refundable except where required by law. We may change prices with 30 days&apos; notice.</p>
      <h2 className="text-slate-900">3. Your responsibilities</h2>
      <ul className="list-disc pl-5">
        <li>You are responsible for your coaching advice and for holding appropriate qualifications and insurance.</li>
        <li>You must have a lawful basis to add each client, and only invite clients aged 18 or over.</li>
        <li>You must review AI-generated content before sending it. AI output can be wrong and is not medical advice.</li>
        <li>Keep your login secure and don&apos;t misuse the service.</li>
      </ul>
      <h2 className="text-slate-900">4. Data processing (UK GDPR Article 28)</h2>
      <p>For client personal data you store in COACHOS, you are the controller and we are your processor. We will: process it only on your documented instructions (using COACHOS as designed); ensure staff are bound by confidentiality; apply appropriate security measures; use only the sub-processors listed in our Privacy Policy (and tell you about changes); help you respond to data subject requests and data breaches; delete or return data when you close your account; and give you the information needed to demonstrate compliance. We will notify you without undue delay of any personal data breach affecting your clients.</p>
      <h2 className="text-slate-900">5. Availability</h2>
      <p>We aim for high availability but don&apos;t guarantee uninterrupted service. Keep your own records of anything critical.</p>
      <h2 className="text-slate-900">6. Liability</h2>
      <p>Nothing limits liability for death or personal injury caused by negligence, or for fraud. Otherwise our total liability is limited to the fees you paid in the 12 months before the claim, and we&apos;re not liable for indirect losses or lost profits.</p>
      <h2 className="text-slate-900">7. Ending the service</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that breach these terms. On closure, data is deleted as described in the Privacy Policy.</p>
      <h2 className="text-slate-900">8. Law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
      <p>Last updated: [DATE] · Contact: [EMAIL]</p>
    </main>
  );
}
