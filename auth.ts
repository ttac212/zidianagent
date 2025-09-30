import type { DefaultSession, NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authenticate } from './auth/strategies'

// Augment session user with extra fields we expose to client
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role?: string
      displayName?: string | null
      currentMonthUsage?: number
      monthlyTokenLimit?: number
    }
  }

  // Augment User type for provider callbacks
  interface User {
    id: string
    email: string | null
    name: string | null
    role: string
    displayName: string | null
    currentMonthUsage: number
    monthlyTokenLimit: number
  }
}

// Augment JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    displayName: string | null
    currentMonthUsage: number
    monthlyTokenLimit: number
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  debug: false,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "password" },
      },
      async authorize(credentials) {
        // 使用统一的认证策略（自动根据环境选择）
        // Linus: "Simple is beautiful" - 所有逻辑都在策略中
        if (!credentials) return null

        return authenticate({
          email: credentials.email,
          code: credentials.code
        })
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.displayName = user.displayName
        token.currentMonthUsage = user.currentMonthUsage
        token.monthlyTokenLimit = user.monthlyTokenLimit
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.displayName = token.displayName
        session.user.currentMonthUsage = token.currentMonthUsage
        session.user.monthlyTokenLimit = token.monthlyTokenLimit
      }
      return session
    },
  },
}

