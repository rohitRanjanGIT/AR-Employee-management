import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)

  // Optimistic check only: a present cookie does NOT mean a valid session.
  // Real validation + role enforcement happens in the page server components.
  // We deliberately do NOT redirect logged-in users away from /login here —
  // that would create an infinite loop with a stale/invalid cookie. The login
  // page redirects validated sessions to the correct dashboard itself.
  if (!sessionCookie && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Skip public files such as `/AnuranjanLogo.png`; only protect app routes.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
