import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_COOKIE_NAME = 'feedbackiq_session';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/api/auth/login',
  '/api/feedback', // POST /api/feedback is public
  '/api/health',
  '/api/uploads',
];

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-token-at-least-32-chars-long';
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, Next.js internal files, favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check if current route is public
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    (pathname === '/api/feedback' && request.method === 'POST');

  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;

  let isValid = false;
  if (token) {
    try {
      await jwtVerify(token, getJwtSecret());
      isValid = true;
    } catch {
      isValid = false;
    }
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!isValid) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Protect /api routes (except public ones)
  if (pathname.startsWith('/api') && !isPublic) {
    if (!isValid) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }
  }

  // If user is logged in and visits /login, redirect to /admin
  if (pathname === '/login' && isValid) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
