import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { Splash, SPLASH_SCRIPT } from '@/components/splash';

export const metadata: Metadata = {
  title: 'COACHOS — the operating system for online fitness coaches',
  description: 'Spend less time managing clients. Deliver more personalised coaching. Keep your clients engaged.',
  appleWebApp: { capable: true, title: 'COACHOS', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#0a0b13', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} /></head>
      <body>
        <Splash />
        {children}
      </body>
    </html>
  );
}
