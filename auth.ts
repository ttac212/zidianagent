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
            console.error('DEV_LOGIN_CODE detected in production environment')
            return null
          }

          // 开发环境允许使用开发登录码
          if (!isProduction && devCode) {
            if (!credentials?.email || !credentials?.code) {
              console.log('Missing credentials in dev mode')
              return null
            }

            if (credentials.code !== devCode) {
              console.log('Invalid dev code')
              return null
            }

            try {
              // 开发环境：查找或创建用户
              let user = await prisma.user.findUnique({
                where: { email: credentials.email }
              })

              if (!user) {
                // 开发环境自动创建用户
                user = await prisma.user.create({
                  data: {
                    email: credentials.email,
                    username: credentials.email.split('@')[0],
                    displayName: credentials.email.split('@')[0],
                    role: 'USER',
                    status: 'ACTIVE',
                    emailVerified: new Date(),
                  }
                })
              }

              return {
                id: user.id,
                email: user.email,
                name: user.displayName || user.username || user.email,
                role: user.role
              }
            } catch (dbError) {
              console.error('Database error in dev mode:', dbError)
              throw new Error('Database connection failed. Please run: pnpm db:generate && pnpm db:push')
            }
          } else if (isProduction) {
            // 生产环境认证逻辑
            if (!credentials?.email || !credentials?.code) {
              return null
            }
            
            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(credentials.email)) {
              return null
            }
            
            // 查找用户
            const user = await prisma.user.findUnique({ 
              where: { email: credentials.email } 
            })
            
            if (!user) {
              // 生产环境不自动创建用户，需要通过邀请码注册
              return null
            }
            
            // 验证邮箱是否已验证
            if (!user.emailVerified) {
              throw new Error('EMAIL_NOT_VERIFIED')
            }
            
            // 验证邀请码或临时验证码
            // 这里可以实现：
            // 1. 邀请码验证（已有 InviteCode 表）
            // 2. 临时验证码（通过邮件发送）
            // 3. OAuth 回调后的验证
            
            // 示例：验证邀请码
            if (user.inviteCodeId) {
              const inviteCode = await prisma.inviteCode.findUnique({
                where: { id: user.inviteCodeId }
              })
              
              if (!inviteCode || inviteCode.code !== credentials.code) {
                return null
              }
              
              // 检查邀请码是否过期或达到使用限制
              if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
                return null
              }
              
              if (inviteCode.maxUses && inviteCode.usedCount >= inviteCode.maxUses) {
                return null
              }
            }
            
            // 验证通过，返回用户信息
            return {
              id: user.id,
              email: user.email,
              name: user.displayName || user.username || user.email,
              role: user.role
            }
          } else {
            return null
          }
        } catch (error) {
          // 详细记录错误信息，帮助调试
          console.error('[NextAuth] Authorization error:', {
            message: (error as Error).message,
            stack: (error as Error).stack,
            credentials: credentials ? { email: credentials.email } : undefined
          })
          // 重新抛出错误，让 NextAuth 能正确处理
          throw error
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

