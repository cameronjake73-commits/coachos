import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Not configured yet (no Supabase env vars): let public pages render instead of crashing every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          headers.set('cookie', request.cookies.toString());
          response = NextResponse.next({ request: { headers } });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (e) {
    console.error('auth check failed', e);
  }
  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith('/coach') || path.startsWith('/app'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  // Send people to their own side without a page render (saves a round trip when the home-screen app opens /app).
  if (user) {
    const role = (user.user_metadata as { role?: string } | undefined)?.role;
    const to = path === '/app' && role === 'coach' ? '/coach' : path === '/coach' && role === 'client' ? '/app' : null;
    if (to) {
      const url = request.nextUrl.clone();
      url.pathname = to;
      const r = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => r.cookies.set(c));
      return r;
    }
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-touch-icon.png|icon-192.png|icon-512.png|api/stripe/webhook|api/cron).*)'],
};
