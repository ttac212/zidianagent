import type { DefaultSession, NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

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
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  debug: false, // 暂时关闭调试避免客户端错误
  providers: [
    Credentials({
      name: "Development Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "password" },
      },
      async authorize(credentials) {
        try {
          // 生产环境安全检查
          const isProduction = process.env.NODE_ENV === 'production'
          const devCode = process.env.DEV_LOGIN_CODE
          
          // 生产环境不允许使用开发登录码
          if (isProduction && devCode) {
            return null
          }
          
          // 开发环境允许使用开发登录码
          if (!isProduction && devCode) {
            if (!credentials?.email || !credentials?.code) {
              return null
            }
            
            if (credentials.code !== devCode) {
              return null
            }
          } else if (isProduction) {
            // 生产环境应该使用正式的认证方式
            // TODO: 实现正式的认证逻辑（OAuth、邮箱验证等）
            return null
          } else {
            return null
          }

          const user = await prisma.user.findUnique({ where: { email: credentials.email } })
          if (!user) {
            return null
          }
          
          if (user.status !== "ACTIVE") {
            return null
          }
          
          return {
            id: user.id,
            email: user.email,
            name: user.displayName ?? user.username ?? undefined,
            role: user.role,
            displayName: user.displayName ?? null,
            currentMonthUsage: user.currentMonthUsage,
            monthlyTokenLimit: user.monthlyTokenLimit,
          } as any
        } catch (error) {
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login', // 错误页面重定向到登录页
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, merge db fields into token
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.displayName = (user as any).displayName
        token.currentMonthUsage = (user as any).currentMonthUsage
        token.monthlyTokenLimit = (user as any).monthlyTokenLimit
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token as any).id
        session.user.role = (token as any).role
        session.user.displayName = (token as any).displayName
        session.user.currentMonthUsage = (token as any).currentMonthUsage
        session.user.monthlyTokenLimit = (token as any).monthlyTokenLimit
      }
      return session
    },
  },
}

