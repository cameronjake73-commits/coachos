'use client';
import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './icons';
import { buildRows, guessMapping, IMPORT_FIELDS, parseCsv, TEMPLATE_CSV, type Mapping } from '@/lib/csv-import';

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || count === 0} className="btn-primary w-full sm:w-auto">
      {pending ? 'Importing…' : `Import ${count} client${count === 1 ? '' : 's'}`}
    </button>
  );
}

export function ImportWizard({ action, existingEmails, placesLeft }: { action: (fd: FormData) => void | Promise<void>; existingEmails: string[]; placesLeft: number }) {
  const [raw, setRaw] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({});
  const [paste, setPaste] = useState('');

  const load = (text: string, name: string) => {
    const rows = parseCsv(text);
    if (rows.length < 1) { setErr('That file looks empty.'); return; }
    setErr(null); setRaw(rows); setFileName(name);
    const guess = guessMapping(rows[0]);
    const looksLikeHeader = Object.keys(guess).length >= 2;
    setHasHeader(looksLikeHeader);
    setMapping(looksLikeHeader ? guess : { full_name: 0, email: 1 });
  };

  const headers = raw ? (hasHeader ? raw[0] : raw[0].map((_, i) => `Column ${i + 1}`)) : [];
  const data = useMemo(() => (raw ? (hasHeader ? raw.slice(1) : raw) : []), [raw, hasHeader]);
  const existing = useMemo(() => new Set(existingEmails.map((e) => e.toLowerCase())), [existingEmails]);
  const rows = useMemo(() => {
    const built = buildRows(data, mapping);
    const seen = new Set<string>();
    return built.map((r) => {
      const errors = [...r.errors];
      if (r.email && existing.has(r.email)) errors.push('Already a client');
      else if (r.email && seen.has(r.email)) errors.push('Duplicate in file');
      if (r.email) seen.add(r.email);
      return { ...r, errors };
    });
  }, [data, mapping, existing]);
  const valid = rows.filter((r) => !r.errors.length);
  const toImport = valid.slice(0, Math.max(0, placesLeft));
  const overLimit = valid.length - toImport.length;

  if (!raw) {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-100/30 px-4 py-10 text-center transition hover:border-brand-500/60">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-300"><Icon name="arrowUp" /></span>
          <span className="font-medium">Choose a CSV file</span>
          <span className="max-w-sm text-[13px] text-slate-500">Export your client list from Trainerize, Everfit, Google Sheets or Excel (File → Download / Save as → CSV).</span>
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            if (/\.(xlsx?|numbers)$/i.test(f.name)) { setErr('That’s a spreadsheet file. Save it as CSV first (File → Save as → CSV), then upload that.'); return; }
            if (f.size > 2 * 1024 * 1024) { setErr('File is too big (max 2MB).'); return; }
            load(await f.text(), f.name);
          }} />
        </label>
        {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">Or paste rows instead</summary>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="input mt-3 font-mono text-xs" placeholder={'Full name,Email,Monthly fee\nJane Smith,jane@example.com,150'} />
          <button type="button" className="btn-secondary btn-sm mt-2" disabled={!paste.trim()} onClick={() => load(paste, 'Pasted rows')}>Use these rows</button>
        </details>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`} download="coachos-clients-template.csv" className="inline-flex items-center gap-1.5 text-[13px] link"><Icon name="arrowDown" className="h-4 w-4" />Download a template</a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="rows" value={JSON.stringify(toImport.map(({ errors, ...r }) => r))} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2"><Icon name="checkCircle" className="h-4 w-4 text-emerald-400" /><span className="font-medium">{fileName}</span><span className="text-slate-500">· {data.length} row{data.length === 1 ? '' : 's'}</span></span>
        <button type="button" onClick={() => { setRaw(null); setPaste(''); }} className="btn-ghost btn-sm">Choose another file</button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3>Match your columns</h3>
          <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />First row is column names</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IMPORT_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="label">{f.label}{'required' in f && f.required ? ' *' : ''}</span>
              <select className="input" value={mapping[f.key] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                <option value="">Don’t import</option>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">No “Full name” column? Map First name and Last name instead. UK dates like 01/12/2026 are read as 1 December.</p>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <h3 className="mr-2">Preview</h3>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{valid.length} ready</span>
          {rows.length - valid.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{rows.length - valid.length} will be skipped</span>}
        </div>
        <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="sticky top-0 bg-[#141626] text-left text-xs text-slate-500"><tr>
              <th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Fee</th><th className="px-3 py-2 font-medium">Renews</th><th className="px-3 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i} className={r.errors.length ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2">{r.full_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-slate-600">{r.email || <span className="text-slate-400">—</span>}</td>
                  <td className="num px-3 py-2">{r.monthly_fee != null ? `£${r.monthly_fee}` : '—'}</td>
                  <td className="num px-3 py-2">{r.renewal_date ?? '—'}</td>
                  <td className="px-3 py-2">{r.errors.length ? <span className="text-red-700">{r.errors.join(', ')}</span> : <span className="text-emerald-700">Ready</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && <p className="text-xs text-slate-500">Showing the first 200 rows.</p>}
      </section>

      {overLimit > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">You have {placesLeft} client place{placesLeft === 1 ? '' : 's'} left, so only the first {toImport.length} will be imported. Upgrade in Billing to import the other {overLimit}.</p>}

      <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="send_email" className="mt-0.5" />
          <span><span className="text-slate-800">Email everyone their invite link now</span><span className="block text-xs text-slate-500">Leave off to send links yourself by DM or WhatsApp later.</span></span>
        </label>
        <Submit count={toImport.length} />
      </div>
    </form>
  );
}
