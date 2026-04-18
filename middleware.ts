// middleware.ts — Route protection
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // All matched routes require auth — redirect to login if not authed
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/nutrition/:path*',
    '/workout/:path*',
    '/coach/:path*',
    '/progress/:path*',
    '/simulator/:path*',
    '/settings/:path*',
    '/foods/:path*',
    '/api/dashboard/:path*',
    '/api/meals/:path*',
    '/api/workouts/:path*',
    '/api/sleep/:path*',
    '/api/mood/:path*',
    '/api/weight/:path*',
    '/api/biomarkers/:path*',
    '/api/gemini/:path*',
    '/api/user/:path*',
    '/api/badges/:path*',
  ],
}
