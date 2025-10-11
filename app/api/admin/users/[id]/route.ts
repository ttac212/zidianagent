/**
 * 用户管理详情 API
 * PUT /api/admin/users/:id - 更新用户信息
 * DELETE /api/admin/users/:id - 删除用户（软删除）
 */

import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { 
  createErrorResponse, 
  createSuccessResponse, 
  requireAuth,
  withErrorHandler,
  ApiError,
  API_ERROR_CODES
} from "@/lib/api/error-handler"

export const PUT = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const token = await getToken({ req: request as any })
  
  // 统一认证检查 - 只有管理员能修改用户
  const authError = requireAuth(token, 'ADMIN')
  if (authError) return createErrorResponse(authError)

  const { role, status, monthlyTokenLimit, displayName } = await request.json()

  // 验证用户是否存在
  const existingUser = await prisma.user.findUnique({
    where: { id: params.id }
  })

  if (!existingUser) {
    return createErrorResponse(new ApiError(
      API_ERROR_CODES.NOT_FOUND,
      "用户不存在",
      404
    ))
  }

  // 防止管理员修改自己的角色（避免锁死）
  if (existingUser.id === token.sub && role && role !== existingUser.role) {
    return createErrorResponse(new ApiError(
      API_ERROR_CODES.FORBIDDEN,
      "不能修改自己的角色",
      403
    ))
  }

  // 构建更新数据
  const updateData: any = {}
  if (role !== undefined) {
    // 验证角色是否有效
    const validRoles = ['ADMIN', 'USER', 'GUEST']
    if (!validRoles.includes(role.toUpperCase())) {
      return createErrorResponse(new ApiError(
        API_ERROR_CODES.VALIDATION_FAILED,
        "无效的用户角色",
        400,
        { validRoles, providedRole: role }
      ))
    }
    updateData.role = role.toUpperCase()
  }
  if (status !== undefined) {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
    if (!validStatuses.includes(status.toUpperCase())) {
      return createErrorResponse(new ApiError(
        API_ERROR_CODES.VALIDATION_FAILED,
        "无效的用户状态",
        400,
        { validStatuses, providedStatus: status }
      ))
    }
    updateData.status = status.toUpperCase()
  }
  if (monthlyTokenLimit !== undefined) updateData.monthlyTokenLimit = Number(monthlyTokenLimit)
  if (displayName !== undefined) updateData.displayName = displayName

  // 更新用户
  const updatedUser = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      monthlyTokenLimit: true,
      currentMonthUsage: true,
      totalTokenUsed: true,
      createdAt: true,
      updatedAt: true,
      lastActiveAt: true,
      _count: {
        select: {
          conversations: true,
          usageStats: true
        }
      }
    }
  })

  // 格式化返回数据
  const formattedUser = {
    id: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    displayName: updatedUser.displayName,
    role: updatedUser.role.toLowerCase(),
    status: updatedUser.status.toLowerCase(),
    monthlyTokenLimit: updatedUser.monthlyTokenLimit,
    currentMonthUsage: updatedUser.currentMonthUsage,
    totalTokensUsed: updatedUser.totalTokenUsed,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
    lastLoginAt: updatedUser.lastActiveAt?.toISOString() || null,
    totalConversations: updatedUser._count.conversations,
    totalSessions: updatedUser._count.usageStats,
    permissions: generatePermissions(updatedUser.role)
  }

  return createSuccessResponse(formattedUser, "用户更新成功")
})

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const token = await getToken({ req: request as any })
  
  // 统一认证检查 - 只有管理员能删除用户
  const authError = requireAuth(token, 'ADMIN')
  if (authError) return createErrorResponse(authError)

  // 验证用户是否存在
  const existingUser = await prisma.user.findUnique({
    where: { id: params.id }
  })

  if (!existingUser) {
    return createErrorResponse(new ApiError(
      API_ERROR_CODES.NOT_FOUND,
      "用户不存在",
      404
    ))
  }

  // 防止管理员删除自己
  if (existingUser.id === token.sub) {
    return createErrorResponse(new ApiError(
      API_ERROR_CODES.FORBIDDEN,
      "不能删除自己的账号",
      403
    ))
  }

  // 软删除：将状态设置为 DELETED
  await prisma.user.update({
    where: { id: params.id },
    data: { 
      status: 'DELETED',
      updatedAt: new Date()
    }
  })

  return createSuccessResponse(
    { id: params.id, deleted: true },
    "用户已删除"
  )
})

/**
 * 根据用户角色生成权限列表
 */
function generatePermissions(role: string): string[] {
  const allPermissions = ["chat", "documents", "trending", "export", "admin"]

  switch (role.toUpperCase()) {
    case "ADMIN":
      return allPermissions
    case "USER":
      return ["chat", "documents", "trending", "export"]
    case "GUEST":
      return ["chat"]
    default:
      return ["chat"]
  }
}
