// app/api/auth/[...nextauth]/route.ts
// Only exports HTTP handlers (GET, POST) — Next.js 14 enforces this.
// Auth configuration lives in lib/auth.ts so other API routes can import it.
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
