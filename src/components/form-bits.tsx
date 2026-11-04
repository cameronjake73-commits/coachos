'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

/** A <select> that submits its form as soon as the value changes (for filters and sorting). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/** Submit button that asks for confirmation first. */
export function ConfirmButton({ children, message, className = 'btn-secondary', formAction }: { children: React.ReactNode; message: string; className?: string; formAction?: (fd: FormData) => void | Promise<void> }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} className={className} disabled={pending}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

/**
 * Wraps a server-action form and submits it automatically shortly after the user stops typing,
 * with a small "Saving… / Saved" indicator. Used by the programme builder rows.
 */
export function AutoSaveForm({ action, children, className }: { action: (fd: FormData) => void | Promise<void>; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');

  const submit = async () => {
    if (!ref.current) return;
    setState('saving');
    await action(new FormData(ref.current));
    setState('saved');
    setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1500);
  };
  const schedule = () => {
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(submit, 700);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <form ref={ref} className={className} onChange={schedule} onSubmit={(e) => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); submit(); }}>
      {children}
      <span aria-live="polite" className={`pointer-events-none text-2xs transition ${state === 'idle' ? 'opacity-0' : 'opacity-100'} ${state === 'saved' ? 'text-emerald-700' : 'text-slate-500'}`}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'dirty' ? 'Editing…' : 'Saved'}
      </span>
    </form>
  );
}

/** Focuses its input on mount when `focus` is true (used for "tap search" on mobile). */
export function SearchInput({ focus, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { focus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, [focus]);
  return <input ref={ref} {...props} />;
}

/** Scroll container that starts at (and stays pinned to) the bottom, for chat threads. */
export function ScrollBottom({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; });
  return <div ref={ref} className={className}>{children}</div>;
}

/** Submit button that reacts the instant it's pressed (dims and pulses while the server finishes). */
export function PendingButton({ children, className = 'btn-secondary', pendingLabel, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} className={`${className} ${pending ? 'animate-pulse opacity-60' : ''}`} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
