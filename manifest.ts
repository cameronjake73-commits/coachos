import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'COACHOS',
    short_name: 'COACHOS',
    description: 'Your coaching app: workouts, check-ins and progress.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#090d1c',
    theme_color: '#090d1c',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
