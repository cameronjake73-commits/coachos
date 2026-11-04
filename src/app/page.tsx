import Link from 'next/link';
import { redirectIfSignedIn } from '@/lib/auth';
import { FEATURES, FOUNDING, PLANS, foundingOpen } from '@/lib/plans';

const features = [
  ['Client management', 'Profiles, onboarding, goals, measurements, progress photos and subscription status in one place.'],
  ['Workout programming', 'Build programmes from a 60+ exercise library (or your own videos) and assign them in seconds.'],
  ['Weekly check-ins', 'Clients submit weight, sleep, energy, adherence and photos from their phone. Full history, always.'],
  ['AI coaching assistant', 'Summaries, week-on-week comparisons, flagged concerns and a drafted reply in your voice. You approve everything.'],
  ['Retention dashboard', 'See who is slipping before they cancel: missed check-ins, skipped workouts, overdue payments, renewals.'],
  ['Client app', 'A mobile web app your clients add to their home screen. No App Store downloads.'],
];

export default async function Home() {
  await redirectIfSignedIn();
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold"><img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS</div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="link">Log in</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">Spend less time managing clients.<br />Keep more of them.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          COACHOS is the operating system for independent online fitness coaches: programming, check-ins,
          an AI assistant that drafts your replies, and a dashboard that tells you who needs you this week.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">Start 14-day free trial</Link>
          <a href="#pricing" className="btn-secondary px-6 py-3 text-base">See pricing</a>
        </div>
        <p className="mt-3 text-sm text-slate-500">No card needed. Unlimited clients during your trial.</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([t, d]) => (
          <div key={t} className="card">
            <h2 className="text-base">{t}</h2>
            <p className="mt-2 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-2 text-center text-2xl">One price. Everything included.</h2>
        <p className="mb-8 text-center text-slate-600">No tiers, no per-client fees, no add-ons.</p>
        <div className="card mx-auto max-w-md border-brand-200 p-6 text-center shadow-glow">
          <div className="font-semibold">{PLANS.pro.name}</div>
          <div className="mt-2 text-5xl font-bold tracking-tight">£{PLANS.pro.priceGbp}<span className="text-base font-normal text-slate-500">/month</span></div>
          {foundingOpen() && <div className="mt-2 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-100">Founding coaches: £{FOUNDING.priceGbp}/month for life. First {FOUNDING.spots} only.</div>}
          <ul className="mt-6 space-y-2 text-left text-sm text-slate-700">
            {FEATURES.map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-400">✓</span>{f}</li>)}
          </ul>
          <Link href="/signup" className="btn-primary mt-6 w-full">Start 14-day free trial</Link>
          <p className="mt-2 text-xs text-slate-500">No card needed for the trial.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} COACHOS · <Link href="/privacy" className="link">Privacy</Link> · <Link href="/terms" className="link">Terms</Link>
      </footer>
    </main>
  );
}
