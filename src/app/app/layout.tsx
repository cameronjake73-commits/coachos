import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUserAndRole } from '@/lib/auth';
import { ClientNav } from '@/components/client-nav';
import { Flash } from '@/components/flash';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, role } = await getUserAndRole();
  if (!user) redirect('/login');
  if (role === 'coach') redirect('/coach');
  const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender', 'coach').is('read_at', null);
  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <main className="mx-auto max-w-md animate-fade-in px-4 pt-6">{children}</main>
      <ClientNav unread={count ?? 0} />
      <Suspense><Flash /></Suspense>
    </div>
  );
}
