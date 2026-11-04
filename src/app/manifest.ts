import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'COACHOS',
    short_name: 'COACHOS',
    description: 'Your coaching app: workouts, check-ins and progress.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0a0b13',
    theme_color: '#0a0b13',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
