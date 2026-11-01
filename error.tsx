'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="card max-w-sm text-center">
        <h1>Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">Sorry, that didn&apos;t work. Try again, and if it keeps happening let us know{error.digest ? ` (ref ${error.digest})` : ''}.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          <a href="/" className="btn-secondary">Home</a>
        </div>
      </div>
    </main>
  );
}
