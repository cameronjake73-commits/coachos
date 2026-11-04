/**
 * Root loading boundary: lets the page shell (and the opening animation) stream to the
 * phone straight away, while the server is still fetching the dashboard data.
 */
export default function Loading() {
  return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
}
