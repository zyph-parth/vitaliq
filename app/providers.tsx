'use client'
// app/providers.tsx
// Single root-level SessionProvider — eliminates the need for per-route layouts

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
