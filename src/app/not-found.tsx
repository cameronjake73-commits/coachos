import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-sm text-center">
        <h1>Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">That page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/" className="btn-primary mt-4">Go home</Link>
      </div>
    </main>
  );
}
