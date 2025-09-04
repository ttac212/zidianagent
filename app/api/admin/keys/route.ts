import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return Response.json({ error: "未认证" }, { status: 401 })
    if ((token as any).role !== "ADMIN") return Response.json({ error: "无权限" }, { status: 403 })

    // 模拟API密钥数据
    const keys = generateMockApiKeys()

    return Response.json({
      success: true,
      data: keys,
    })
  } catch (error) {
    return Response.json({ success: false, error: "获取密钥列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, permissions, expiresAt, maxUsage } = await request.json()

    // 生成新的API密钥
    const newKey = {
      id: `key_${Date.now()}`,
      key: `ak_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      name,
      permissions,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt,
      maxUsage,
      currentUsage: 0,
      lastUsedAt: null,
    }

    return Response.json({
      success: true,
      data: newKey,
      message: "API密钥创建成功",
    })
  } catch (error) {
    return Response.json({ success: false, error: "创建API密钥失败" }, { status: 500 })
  }
}

function generateMockApiKeys() {
  const statuses = ["active", "inactive", "expired"]

  return Array.from({ length: 20 }, (_, i) => ({
    id: `key_${i + 1}`,
    key: `ak_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    name: `API密钥${i + 1}`,
    permissions: generatePermissions(["admin", "premium", "user"][i % 3]),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt:
      Math.random() > 0.3 ? new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() : null,
    maxUsage: Math.random() > 0.5 ? Math.floor(Math.random() * 10000) + 1000 : null,
    currentUsage: Math.floor(Math.random() * 5000),
    lastUsedAt: Math.random() > 0.2 ? new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString() : null,
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
