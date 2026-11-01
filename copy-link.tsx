'use client';
import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-secondary whitespace-nowrap"
        onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
