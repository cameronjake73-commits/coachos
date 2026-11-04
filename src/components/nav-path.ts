'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** The current path, but switched to a tapped link straight away so tabs highlight on touch instead of after the page arrives. */
export function useNavPath() {
  const path = usePathname();
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  const tap = (href: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    setTapped(href);
  };
  return { path: tapped ?? path, tap };
}
