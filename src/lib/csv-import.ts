/** Client import from CSV (Trainerize/Everfit exports, Google Sheets, Excel "Save as CSV"). Used on both client and server. */

export const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true, aliases: ['name', 'full name', 'client', 'client name', 'fullname'] },
  { key: 'first_name', label: 'First name', aliases: ['first name', 'firstname', 'first', 'forename', 'given name'] },
  { key: 'last_name', label: 'Last name', aliases: ['last name', 'lastname', 'surname', 'last', 'family name'] },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'email address', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'phone number', 'telephone', 'tel', 'whatsapp'] },
  { key: 'goal', label: 'Goal', aliases: ['goal', 'goals', 'main goal', 'objective'] },
  { key: 'monthly_fee', label: 'Monthly fee (£)', aliases: ['fee', 'monthly fee', 'price', 'amount', 'monthly price', 'rate', 'payment'] },
  { key: 'renewal_date', label: 'Next renewal date', aliases: ['renewal', 'renewal date', 'next payment', 'next billing', 'next payment date', 'renews'] },
  { key: 'start_date', label: 'Start date', aliases: ['start', 'start date', 'joined', 'date joined', 'signup date', 'created'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments'] },
] as const;
export type ImportKey = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<ImportKey, number>>;

export interface ImportRow {
  full_name: string; email: string; phone: string | null; goal: string | null; monthly_fee: number | null;
  renewal_date: string | null; start_date: string | null; notes: string | null; errors: string[];
}

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, commas/semicolons/tabs, CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const h = headers.map(norm);
  for (const f of IMPORT_FIELDS) {
    const idx = h.findIndex((x, i) => !Object.values(m).includes(i) && (x === norm(f.label) || (f.aliases as readonly string[]).map(norm).includes(x)));
    if (idx >= 0) m[f.key] = idx;
  }
  return m;
}

/** Accepts 2026-11-03, 03/11/2026, 3/11/26 (UK day-first), 3 Nov 2026. Returns yyyy-mm-dd or null. */
export function parseDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t); y = dt.getFullYear(); mo = dt.getMonth() + 1; d = dt.getDate();
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseMoney(v: string): number | null {
  const s = v.replace(/[£$€,\s]/g, '').replace(/(per|\/)\s*(month|mo|m)$/i, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : NaN;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildRows(data: string[][], mapping: Mapping): ImportRow[] {
  const get = (r: string[], k: ImportKey) => (mapping[k] != null ? (r[mapping[k]!] ?? '').trim() : '');
  return data.map((r) => {
    const errors: string[] = [];
    const name = (get(r, 'full_name') || [get(r, 'first_name'), get(r, 'last_name')].filter(Boolean).join(' ')).replace(/\s+/g, ' ').slice(0, 120);
    const email = get(r, 'email').toLowerCase();
    if (!name) errors.push('Missing name');
    if (!email) errors.push('Missing email');
    else if (!EMAIL.test(email)) errors.push('Invalid email');
    const feeRaw = get(r, 'monthly_fee');
    const fee = feeRaw ? parseMoney(feeRaw) : null;
    if (fee != null && Number.isNaN(fee)) errors.push(`Fee "${feeRaw}" isn't a number`);
    const date = (k: 'renewal_date' | 'start_date', label: string) => {
      const raw = get(r, k); if (!raw) return null;
      const p = parseDate(raw); if (!p) errors.push(`${label} "${raw}" isn't a date`);
      return p;
    };
    return {
      full_name: name, email, phone: get(r, 'phone').slice(0, 40) || null, goal: get(r, 'goal').slice(0, 300) || null,
      monthly_fee: fee != null && !Number.isNaN(fee) ? fee : null,
      renewal_date: date('renewal_date', 'Renewal date'), start_date: date('start_date', 'Start date'),
      notes: get(r, 'notes').slice(0, 5000) || null, errors,
    };
  });
}

export const TEMPLATE_CSV = 'Full name,Email,Phone,Goal,Monthly fee,Next renewal date,Start date,Notes\nJane Smith,jane@example.com,07700 900123,Lose 6kg for summer,150,01/12/2026,01/09/2026,Prefers morning sessions\n';
