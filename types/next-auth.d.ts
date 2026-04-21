import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      profileComplete?: boolean
    }
  }
  interface User {
    id: string
    profileComplete?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    profileComplete?: boolean
  }
}
