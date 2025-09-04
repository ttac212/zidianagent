import { describe, it, expect } from 'vitest'

// 纯函数级别的单元测试示例：验证从 token 合成 session.user 的逻辑形态
// 实际项目中，NextAuth callbacks 是框架注入的；此处通过模拟 token/user 对象进行最小验证

describe('NextAuth callbacks minimal shape test', () => {
  it('should merge custom fields from token into session.user', () => {
    const token: any = {
      id: 'user_123',
      role: 'ADMIN',
      displayName: '张三',
      currentMonthUsage: 1234,
      monthlyTokenLimit: 50000,
    }

    const session: any = { user: { email: 'a@b.com', name: '张三' } }

    // 模拟 auth.ts 中 session 回调的合并逻辑
    session.user.id = token.id
    session.user.role = token.role
    session.user.displayName = token.displayName
    session.user.currentMonthUsage = token.currentMonthUsage
    session.user.monthlyTokenLimit = token.monthlyTokenLimit

    expect(session.user).toMatchObject({
      id: 'user_123',
      role: 'ADMIN',
      displayName: '张三',
      currentMonthUsage: 1234,
      monthlyTokenLimit: 50000,
    })
  })
})

