export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-slate-200" />
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-24 rounded-xl bg-slate-200/70" />)}
    </div>
  );
}
