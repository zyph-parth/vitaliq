// lib/auth.ts - NextAuth configuration (shared authOptions)
// Kept separate from app/api/auth/[...nextauth]/route.ts because Next.js 14
// enforces that route files only export HTTP handler names (GET, POST, etc.).

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

type GoogleProfile = {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  googleId: true,
  profileComplete: true,
} as const

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

function readGoogleProfile(profile: unknown): GoogleProfile {
  return (profile ?? {}) as GoogleProfile
}

async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const googleId = profile.sub?.trim()
  const email = profile.email ? normalizeEmail(profile.email) : ''

  if (!googleId || !email) {
    throw new Error('[VitalIQ] Google sign-in did not return a usable account identity.')
  }

  const name = profile.name?.trim() || email.split('@')[0] || 'VitalIQ User'
  const image = profile.picture?.trim() || null

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId },
        { email },
      ],
    },
    select: AUTH_USER_SELECT,
  })

  if (existingUser) {
    if (existingUser.googleId && existingUser.googleId !== googleId) {
      throw new Error('[VitalIQ] This email is linked to a different Google account.')
    }

    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        googleId: existingUser.googleId ?? googleId,
        image: image ?? existingUser.image,
      },
      select: AUTH_USER_SELECT,
    })
  }

  return prisma.user.create({
    data: {
      email,
      name,
      googleId,
      image,
      profileComplete: false,
      streak: { create: { currentDays: 0, bestDays: 0 } },
    },
    select: AUTH_USER_SELECT,
  })
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const user = await prisma.user.findUnique({
        where: { email: normalizeEmail(credentials.email) },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          profileComplete: true,
        },
      })

      if (!user?.passwordHash) return null

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
      if (!isValid) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        profileComplete: user.profileComplete,
      }
    },
  }),
]

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  )
} else if (process.env.NODE_ENV === 'development') {
  console.warn('[VitalIQ] Google sign-in is disabled until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.')
}

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    // Aligned with middleware - both send unauthenticated users to /login
    signIn: '/login',
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const googleProfile = readGoogleProfile(profile)
        return Boolean(googleProfile.email && googleProfile.email_verified)
      }

      return true
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (account?.provider === 'google') {
        const googleUser = await findOrCreateGoogleUser(readGoogleProfile(profile))
        token.id = googleUser.id
        token.name = googleUser.name
        token.email = googleUser.email
        token.picture = googleUser.image ?? token.picture
        token.profileComplete = googleUser.profileComplete
        return token
      }

      if (user) {
        token.id = user.id
        token.profileComplete = user.profileComplete ?? true
      }

      if (trigger === 'update' && token.id) {
        const refreshedUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: {
            name: true,
            email: true,
            image: true,
            profileComplete: true,
          },
        })

        if (refreshedUser) {
          token.name = refreshedUser.name
          token.email = refreshedUser.email
          token.picture = refreshedUser.image ?? token.picture
          token.profileComplete = refreshedUser.profileComplete
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.id)
        session.user.profileComplete = token.profileComplete ?? true
        session.user.image = typeof token.picture === 'string' ? token.picture : session.user.image
      }
      return session
    },
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

// Fail at startup if NEXTAUTH_SECRET is unset - prevents insecure unsigned JWTs
if (!process.env.NEXTAUTH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[VitalIQ] NEXTAUTH_SECRET is not set. Set it in your environment variables before deploying.')
  } else {
    console.warn('[VitalIQ] WARNING: NEXTAUTH_SECRET is not set. Auth tokens will not be signed correctly.')
  }
}
