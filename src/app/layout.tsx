import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'COACHOS — the operating system for online fitness coaches',
  description: 'Spend less time managing clients. Deliver more personalised coaching. Keep your clients engaged.',
};

export const viewport: Viewport = { themeColor: '#090d1c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
