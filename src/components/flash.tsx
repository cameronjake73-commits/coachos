'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  saved: 'Changes saved',
  sent: 'Message sent',
  archived: 'Client archived',
  restored: 'Client restored',
  renewed: 'Renewal recorded',
  added: 'Added',
  deleted: 'Deleted',
  assigned: 'Programme assigned',
  duplicated: 'Duplicated',
  reviewed: 'Check-in marked as reviewed',
  analysed: 'AI analysis ready',
  drafted: 'Draft ready. Edit it, then send',
  brief: 'Weekly brief updated',
  refreshed: 'Insights refreshed',
};

/** Shows a short confirmation toast for `?flash=<key>` and then removes the param from the URL. */
export function Flash() {
  const sp = useSearchParams();
  const path = usePathname();
  const key = sp.get('flash');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    setMsg(MESSAGES[key] ?? key);
    const next = new URLSearchParams(sp.toString());
    next.delete('flash');
    const qs = next.toString();
    // Tidy the URL without asking the server for the page again (router.replace would re-render it).
    window.history.replaceState(null, '', qs ? `${path}?${qs}` : path);
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
      <div role="status" className="pointer-events-auto flex animate-fade-up items-center gap-2.5 rounded-xl border border-slate-300 bg-[#1a1d2e] px-4 py-2.5 text-sm text-slate-900 shadow-pop">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        {msg}
      </div>
    </div>
  );
}
