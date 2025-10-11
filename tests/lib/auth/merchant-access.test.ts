import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'

describe('hasMerchantAccess - Permission Revocation', () => {
  let testMerchantId: string
  let testUserId: string

  beforeEach(async () => {
    // 创建测试商家
    const merchant = await prisma.merchant.create({
      data: {
        uid: `test-merchant-${Date.now()}`,
        name: 'Test Merchant',
        status: 'ACTIVE'
      }
    })
    testMerchantId = merchant.id

    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        role: 'USER'
      }
    })
    testUserId = user.id
  })

  afterEach(async () => {
    // 清理测试数据
    await prisma.merchantMember.deleteMany({
      where: { merchantId: testMerchantId }
    })
    await prisma.creativeBatch.deleteMany({
      where: { merchantId: testMerchantId }
    })
    await prisma.merchantPromptAsset.deleteMany({
      where: { merchantId: testMerchantId }
    })
    await prisma.merchant.delete({
      where: { id: testMerchantId }
    })
    await prisma.user.delete({
      where: { id: testUserId }
    })
  })

  it('allows access when user is in merchant_members', async () => {
    await prisma.merchantMember.create({
      data: {
        merchantId: testMerchantId,
        userId: testUserId,
        role: 'EDITOR'
      }
    })

    const hasAccess = await hasMerchantAccess(testUserId, testMerchantId, 'USER')
    expect(hasAccess).toBe(true)
  })

  it('denies access after removing from merchant_members', async () => {
    // 添加成员
    const member = await prisma.merchantMember.create({
      data: {
        merchantId: testMerchantId,
        userId: testUserId,
        role: 'EDITOR'
      }
    })

    expect(await hasMerchantAccess(testUserId, testMerchantId, 'USER')).toBe(true)

    // 移除成员
    await prisma.merchantMember.delete({
      where: { id: member.id }
    })

    // 应该立即失效
    expect(await hasMerchantAccess(testUserId, testMerchantId, 'USER')).toBe(false)
  })

  it('does not grant access based on historical batch creation', async () => {
    // 用户曾触发批次，但不在成员表
    await prisma.creativeBatch.create({
      data: {
        merchantId: testMerchantId,
        triggeredBy: testUserId,
        status: 'SUCCEEDED'
      }
    })

    // 应该拒绝（修复后）
    expect(await hasMerchantAccess(testUserId, testMerchantId, 'USER')).toBe(false)
  })

  it('does not grant access based on historical asset creation', async () => {
    // 用户曾创建资产，但不在成员表
    await prisma.merchantPromptAsset.create({
      data: {
        merchantId: testMerchantId,
        type: 'REPORT',
        title: 'Test Report',
        version: 1,
        content: 'Test content',
        createdBy: testUserId
      }
    })

    // 应该拒绝（修复后）
    expect(await hasMerchantAccess(testUserId, testMerchantId, 'USER')).toBe(false)
  })

  it('allows admin to access any merchant', async () => {
    // 管理员无需成员关系
    expect(await hasMerchantAccess(testUserId, testMerchantId, 'ADMIN')).toBe(true)
  })

  it('denies access when userId or merchantId is empty', async () => {
    expect(await hasMerchantAccess('', testMerchantId, 'USER')).toBe(false)
    expect(await hasMerchantAccess(testUserId, '', 'USER')).toBe(false)
    expect(await hasMerchantAccess('', '', 'USER')).toBe(false)
  })
})
