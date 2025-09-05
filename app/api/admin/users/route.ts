import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { 
  createErrorResponse, 
  createSuccessResponse, 
  requireAuth, 
  validateInput,
  withErrorHandler,
  ApiError,
  ApiErrorCode
} from "@/lib/api/error-handler"

export const GET = withErrorHandler(async (request: NextRequest) => {
  const token = await getToken({ req: request as any })
  
  // 统一认证检查
  const authError = requireAuth(token, 'ADMIN')
  if (authError) return createErrorResponse(authError)

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "10"), 100) // 限制最大100条
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "all"

    // 构建查询条件
    const where: any = {}

    // 搜索条件：用户名、邮箱、显示名称
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 状态筛选
    if (status !== "all") {
      where.status = status.toUpperCase() // ACTIVE, INACTIVE, SUSPENDED, DELETED
    }

    // 获取总数（用于分页）
    const total = await prisma.user.count({ where })

    // 获取用户列表
    const users = await prisma.user.findMany({
      where,
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
        // 关联数据统计
        _count: {
          select: {
            conversations: true,
            usageStats: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    // 格式化返回数据
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role.toLowerCase(), // 转换为小写匹配前端期望
      status: user.status.toLowerCase(),
      monthlyTokenLimit: user.monthlyTokenLimit,
      currentMonthUsage: user.currentMonthUsage,
      totalTokensUsed: user.totalTokenUsed,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastActiveAt?.toISOString() || null,
      // 统计数据
      totalConversations: user._count.conversations,
      totalSessions: user._count.usageStats,
      // 生成权限（基于角色）
      permissions: generatePermissions(user.role)
    }))

    // 使用统一成功响应格式
    return createSuccessResponse(
      { users: formattedUsers },
      '获取用户列表成功',
      {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    )
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const token = await getToken({ req: request as any })
  
  // 统一认证检查
  const authError = requireAuth(token, 'ADMIN')
  if (authError) return createErrorResponse(authError)

  const { username, email, role, displayName, monthlyTokenLimit } = await request.json()

  // 使用统一输入验证
  const validationError = validateInput({ username, email, role }, ['username', 'email', 'role'])
  if (validationError) return createErrorResponse(validationError)

  // 验证角色是否有效
  const validRoles = ['ADMIN', 'USER', 'GUEST']
  if (!validRoles.includes(role.toUpperCase())) {
    return createErrorResponse(new ApiError(
      ApiErrorCode.VALIDATION_FAILED, 
      "无效的用户角色", 
      400, 
      { validRoles, providedRole: role }
    ))
  }

  // 检查邮箱是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    return createErrorResponse(new ApiError(
      ApiErrorCode.RESOURCE_CONFLICT, 
      "邮箱已被使用", 
      409, 
      { conflictField: 'email' }
    ))
  }

  // 检查用户名是否已存在（如果提供了用户名）
  if (username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      return createErrorResponse(new ApiError(
        ApiErrorCode.RESOURCE_CONFLICT, 
        "用户名已被使用", 
        409, 
        { conflictField: 'username' }
      ))
    }
  }

    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        displayName: displayName || username,
        role: role.toUpperCase(),
        status: 'ACTIVE',
        monthlyTokenLimit: monthlyTokenLimit || 100000, // 默认10万token
        currentMonthUsage: 0,
        totalTokenUsed: 0,
      },
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
      }
    })

    // 格式化返回数据
    const formattedUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role.toLowerCase(),
      status: newUser.status.toLowerCase(),
      monthlyTokenLimit: newUser.monthlyTokenLimit,
      currentMonthUsage: newUser.currentMonthUsage,
      totalTokensUsed: newUser.totalTokenUsed,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString(),
      lastLoginAt: null,
      totalConversations: 0,
      totalMessages: 0,
      totalSessions: 0,
      permissions: generatePermissions(newUser.role)
    }

    // 使用统一成功响应格式
    return createSuccessResponse(formattedUser, "用户创建成功")
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
