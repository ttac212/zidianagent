/**
 * 商家对标账号关联API
 * GET    /api/merchants/[id]/benchmarks - 获取商家的所有对标账号
 * POST   /api/merchants/[id]/benchmarks - 关联对标账号
 * DELETE /api/merchants/[id]/benchmarks - 取消关联对标账号
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  notFound,
  success
} from '@/lib/api/http-response'
import { withMerchantAuth } from '@/lib/api/merchant-auth'

// GET /api/merchants/[id]/benchmarks - 获取商家的所有对标账号
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      // 检查商家是否存在
      const merchant = await prisma.merchant.findUnique({
        where: { id }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      // 获取所有对标账号关联
      const benchmarks = await prisma.merchantBenchmark.findMany({
        where: { merchantId: id },
        include: {
          benchmark: {
            include: {
              category: true,
              _count: {
                select: { contents: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return success({
        benchmarks: benchmarks.map(b => ({
          id: b.id,
          notes: b.notes,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          benchmark: b.benchmark
        }))
      })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

// POST /api/merchants/[id]/benchmarks - 关联对标账号
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      const body = await req.json()
      const { benchmarkId, notes } = body

      // 验证必填字段
      if (!benchmarkId) {
        return validationError('对标账号ID不能为空')
      }

      // 检查商家是否存在
      const merchant = await prisma.merchant.findUnique({
        where: { id }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      // 检查对标账号是否存在
      const benchmark = await prisma.merchant.findUnique({
        where: { id: benchmarkId }
      })

      if (!benchmark) {
        return notFound('对标账号不存在')
      }

      // 不能把自己设为对标账号
      if (id === benchmarkId) {
        return validationError('不能将自己设为对标账号')
      }

      // 检查是否已经关联
      const existing = await prisma.merchantBenchmark.findUnique({
        where: {
          merchantId_benchmarkId: {
            merchantId: id,
            benchmarkId
          }
        }
      })

      if (existing) {
        return validationError('该对标账号已关联')
      }

      // 创建关联
      const relation = await prisma.merchantBenchmark.create({
        data: {
          merchantId: id,
          benchmarkId,
          notes: notes?.trim() || null
        },
        include: {
          benchmark: {
            include: {
              category: true,
              _count: {
                select: { contents: true }
              }
            }
          }
        }
      })

      return success({
        benchmark: {
          id: relation.id,
          notes: relation.notes,
          createdAt: relation.createdAt,
          updatedAt: relation.updatedAt,
          benchmark: relation.benchmark
        }
      })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

// DELETE /api/merchants/[id]/benchmarks - 取消关联对标账号
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      const body = await req.json()
      const { benchmarkId } = body

      // 验证必填字段
      if (!benchmarkId) {
        return validationError('对标账号ID不能为空')
      }

      // 检查关联是否存在
      const relation = await prisma.merchantBenchmark.findUnique({
        where: {
          merchantId_benchmarkId: {
            merchantId: id,
            benchmarkId
          }
        }
      })

      if (!relation) {
        return notFound('关联不存在')
      }

      // 删除关联
      await prisma.merchantBenchmark.delete({
        where: {
          merchantId_benchmarkId: {
            merchantId: id,
            benchmarkId
          }
        }
      })

      return success({ deleted: true })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

export const dynamic = 'force-dynamic'
