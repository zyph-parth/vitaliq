// middleware.ts - Route protection
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname
    const profileIncomplete = req.nextauth.token?.profileComplete === false

    if (profileIncomplete) {
      const isProfileUpdateRoute = pathname === '/api/user' || pathname.startsWith('/api/user/')

      if (isProfileUpdateRoute) {
        return NextResponse.next()
      }

      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            error: 'Complete your health profile before using this feature.',
            code: 'PROFILE_INCOMPLETE',
          },
          { status: 428 }
        )
      }

      const url = req.nextUrl.clone()
      url.pathname = '/onboarding'
      url.searchParams.set('profile', '1')
      return NextResponse.redirect(url)
    }

    // All matched routes require auth - redirect to login if not authed.
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
