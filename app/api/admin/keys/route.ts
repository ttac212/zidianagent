import type { NextRequest } from "next/server"
import * as dt from '@/lib/utils/date-toolkit'
import { requireAdmin } from '@/lib/auth/admin-guard'
import {
  success,
  validationError,
  serverError
} from '@/lib/api/http-response'


export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    // 模拟 API 密钥数据
    const keys = generateMockApiKeys()

    // 直接返回数据，success函数会添加包装
    return success(keys)
  } catch (error) {
    console.error("获取密钥列表失败", error)
    return serverError('获取密钥列表失败')
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: 必须验证权限！
    const { error } = await requireAdmin(request)
    if (error) return error

    const { name, permissions, expiresAt, maxUsage } = await request.json()

    // 验证输入参数
    if (!name || typeof name !== 'string') {
      return validationError('密钥名称是必需的')
    }

    // 创建新的 API 密钥
    const newKey = {
      id: `key_${dt.timestamp()}`,
      key: `ak_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      name,
      permissions,
      status: "active",
      createdAt: dt.toISO(),
      expiresAt,
      maxUsage,
      currentUsage: 0,
      lastUsedAt: null,
    }

    // 返回新创建的密钥，success函数会添加包装
    return success(newKey)
  } catch (error) {
    console.error("创建 API 密钥失败", error)
    return serverError('创建 API 密钥失败')
  }
}

function generateMockApiKeys() {
  const statuses = ["active", "inactive", "expired"]

  return Array.from({ length: 20 }, (_, i) => ({
    id: `key_${i + 1}`,
    key: `ak_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    name: `API 密钥${i + 1}`,
    permissions: generatePermissions(["admin", "premium", "user"][i % 3]),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    createdAt: new Date(dt.timestamp() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt:
      Math.random() > 0.3 ? new Date(dt.timestamp() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() : null,
    maxUsage: Math.random() > 0.5 ? Math.floor(Math.random() * 10000) + 1000 : null,
    currentUsage: Math.floor(Math.random() * 5000),
    lastUsedAt: Math.random() > 0.2 ? new Date(dt.timestamp() - Math.random() * 24 * 60 * 60 * 1000).toISOString() : null,
  }))
}

function generatePermissions(role: string): string[] {
  const allPermissions = ["chat", "documents", "trending", "export", "admin"]

  switch (role) {
    case "admin":
      return allPermissions
    case "premium":
      return ["chat", "documents", "trending", "export"]
    case "user":
      return ["chat", "documents"]
    default:
      return ["chat"]
  }
}
