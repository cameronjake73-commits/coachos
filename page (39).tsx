// TEMPLATE — have this reviewed by a qualified data-protection adviser before launch.
export const metadata = { title: 'Privacy policy — COACHOS' };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-sm leading-6 text-slate-700">
      <h1 className="text-slate-900">Privacy policy</h1>
      <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Template. Replace the bracketed details and get it reviewed before going live.</p>
      <h2 className="text-slate-900">Who we are</h2>
      <p>COACHOS is operated by [YOUR NAME / COMPANY], [ADDRESS], registered with the UK Information Commissioner&apos;s Office under number [ICO REG NO]. Contact: [EMAIL].</p>
      <h2 className="text-slate-900">Roles</h2>
      <p>For coaches&apos; account and billing data, we are the controller. For client data that coaches store in COACHOS (check-ins, measurements, photos, workouts, messages), the coach is the controller and we act as their processor under a data processing agreement.</p>
      <h2 className="text-slate-900">What we collect</h2>
      <p>Account details (name, email), coaching data entered by coaches and clients, including health data such as weight, body measurements, sleep, energy, stress, injuries and progress photos, and billing details processed by Stripe.</p>
      <h2 className="text-slate-900">Lawful basis</h2>
      <p>Contract (to provide the service). Health data is special category data under UK GDPR Article 9 and is processed only with the client&apos;s explicit consent, recorded during onboarding. Consent can be withdrawn at any time by contacting the coach or us.</p>
      <h2 className="text-slate-900">AI processing</h2>
      <p>To help coaches review check-ins, a client&apos;s first name and check-in data may be sent to our AI provider (Anthropic) to generate a summary and a draft reply. The coach reviews and approves everything before it is sent. Data sent via the API is not used to train AI models. No decisions with legal or similarly significant effects are made automatically.</p>
      <h2 className="text-slate-900">Sub-processors</h2>
      <ul className="list-disc pl-5"><li>Supabase (database, authentication and file storage, [EU/UK region])</li><li>Vercel (hosting)</li><li>Anthropic (AI analysis)</li><li>Stripe (payments)</li></ul>
      <h2 className="text-slate-900">Retention and your rights</h2>
      <p>Client data is kept while the coaching relationship is active and deleted when the coach deletes the client, or within [30] days of a coach closing their account. You have the right to access, correct, export and erase your data, and to complain to the ICO (ico.org.uk).</p>
      <h2 className="text-slate-900">Security</h2>
      <p>Data is encrypted in transit and at rest. Access is restricted by row-level security so coaches can only see their own clients and clients only their own data. Progress photos are stored privately and shown via short-lived links.</p>
      <p>Last updated: [DATE]</p>
    </main>
  );
}
