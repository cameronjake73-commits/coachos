/** Small stroke icon set (24px grid), styled like the rest of the UI. */
const P: Record<string, string> = {
  dashboard: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clients: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.87M15 3.13a3.5 3.5 0 0 1 0 6.75',
  programs: 'M4 5h16v15H4zM4 10h16M9 5V3M15 5V3M8 14h3M8 17h6',
  exercises: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  checkins: 'M9 12l2 2 4-4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  messages: 'M4 4h16v12H8l-4 4zM8 9h8M8 12h5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  billing: 'M3 6h18v12H3zM3 10h18M7 15h4',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  pound: 'M17 20H6s2-1.5 2-5V9a4 4 0 0 1 7.5-2M6 13h8',
  calendar: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  check: 'M5 12l5 5L20 7',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  chevronDown: 'M6 9l6 6 6-6',
  logout: 'M15 4h4v16h-4M10 17l-5-5 5-5M5 12h11',
  plus: 'M12 5v14M5 12h14',
  retention: 'M21 12a9 9 0 1 1-6.2-8.6M21 4v5h-5',
};

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }: { name: keyof typeof P | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? P.dashboard} />
    </svg>
  );
}
