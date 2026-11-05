'use client';
import { useOptimistic, useRef, useEffect, startTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Message list + composer. A sent message appears in the thread instantly (marked "Sending…")
 * while the server saves it; the real message replaces it once the page refreshes.
 */
export function ChatPane({ list, action, hidden, draft, placeholder, composerNote, scrollClass, afterSend, quickReplies = [], firstName = '', banner }: {
  list: React.ReactNode; action: (fd: FormData) => void | Promise<void>; hidden: Record<string, string>;
  draft?: string; placeholder: string; composerNote?: React.ReactNode; scrollClass: string; afterSend?: string;
  quickReplies?: { title: string; body: string }[]; firstName?: string; banner?: React.ReactNode;
}) {
  const [sending, addSending] = useOptimistic<{ key: number; body: string }[], { key: number; body: string }>([], (s, m) => [...s, m]);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; });

  const submit = (fd: FormData) => {
    const body = String(fd.get('body') ?? '').trim();
    if (!body) return;
    startTransition(async () => {
      addSending({ key: Date.now(), body });
      if (box.current) { box.current.value = ''; box.current.rows = 2; }
      try {
        await action(fd);
        if (afterSend) router.replace(afterSend, { scroll: false });
      } catch {
        // Didn't send (e.g. signal dropped): put the text back so nothing is lost.
        if (box.current && !box.current.value) box.current.value = body;
        window.alert("That message didn't send. Check your connection and try again.");
      }
    });
  };

  const insert = (body: string) => {
    const el = box.current; if (!el) return;
    const text = body.replaceAll('{name}', firstName || 'there');
    el.value = el.value.trim() ? `${el.value.trimEnd()}\n\n${text}` : text;
    el.rows = Math.min(8, Math.max(3, Math.ceil(el.value.length / 45)));
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <div className="flex flex-col">
      {banner}
      <div ref={scroller} className={scrollClass}>
        {list}
        {sending.map((m) => (
          <div key={m.key} className="mt-1.5 flex justify-end">
            <div className="max-w-[85%] animate-fade-in whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm leading-relaxed text-white opacity-80 md:max-w-[75%]">
              {m.body}
              <div className="mt-1 text-right text-[10px] text-brand-100/80">Sending…</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-slate-200 pt-3">{composerNote}</div>
      {quickReplies.length > 0 && (
        <div className="scroll-x -mx-1 mb-2 gap-1.5 px-1" aria-label="Saved replies">
          {quickReplies.map((q) => (
            <button key={q.title} type="button" onClick={() => insert(q.body)} title={q.body}
              className="tap inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100/40 px-3 text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900">
              {q.title}
            </button>
          ))}
        </div>
      )}
      <form action={submit}>
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="msg-body">Message</label>
          <textarea ref={box} id="msg-body" name="body" required rows={draft ? 7 : 2} maxLength={5000} className="input flex-1 resize-y" placeholder={placeholder} defaultValue={draft} />
          <button type="submit" className="btn-primary">Send</button>
        </div>
      </form>
    </div>
  );
}
