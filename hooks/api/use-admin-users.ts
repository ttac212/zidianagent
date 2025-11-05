/**
 * 管理员用户管理相关的 React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ==================== 类型定义 ====================

export interface AdminUser {
  id: string
  email: string
  username: string | null
  displayName: string | null
  role: 'USER' | 'ADMIN' | 'GUEST'
  status: 'ACTIVE' | 'SUSPENDED'
  monthlyTokenLimit: number
  currentMonthUsage: number
  totalTokenUsed: number
  createdAt: string
  lastActiveAt: string | null
  _count: {
    conversations: number
    messages: number
  }
}

export interface AdminUsersResponse {
  users: AdminUser[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface UpdateUserData {
  role?: 'USER' | 'ADMIN' | 'GUEST'
  status?: 'ACTIVE' | 'SUSPENDED'
  monthlyTokenLimit?: number
  displayName?: string
}

export interface CreateUserData {
  email: string
  username?: string
  displayName?: string
  role?: 'USER' | 'ADMIN' | 'GUEST'
  monthlyTokenLimit?: number
}

// ==================== Query Keys ====================

export const adminUsersKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...adminUsersKeys.all, 'list'] as const,
  list: (params: { search?: string; page?: number; limit?: number }) =>
    [...adminUsersKeys.lists(), params] as const,
  detail: (id: string) => [...adminUsersKeys.all, 'detail', id] as const,
}

// ==================== Hooks ====================

/**
 * 获取用户列表
 */
export function useAdminUsers(params: {
  search?: string
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: adminUsersKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params.search) searchParams.set('search', params.search)
      if (params.page) searchParams.set('page', String(params.page))
      if (params.limit) searchParams.set('limit', String(params.limit))

      const response = await fetch(`/api/admin/users?${searchParams}`)

      if (!response.ok) {
        throw new Error(`获取用户列表失败: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data as AdminUsersResponse
    },
    staleTime: 1000 * 30, // 30秒
  })
}

/**
 * 获取单个用户详情
 */
export function useAdminUser(userId: string, enabled = true) {
  return useQuery({
    queryKey: adminUsersKeys.detail(userId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}`)

      if (!response.ok) {
        throw new Error(`获取用户详情失败: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data as AdminUser
    },
    enabled,
    staleTime: 1000 * 30,
  })
}

/**
 * 更新用户
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string
      data: UpdateUserData
    }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || '更新用户失败')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (_, { userId }) => {
      // 刷新用户列表
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() })
      // 刷新用户详情
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.detail(userId) })
    },
  })
}

/**
 * 删除用户
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || '删除用户失败')
      }

      return { userId }
    },
    onSuccess: () => {
      // 刷新用户列表
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() })
    },
  })
}

/**
 * 创建用户
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || '创建用户失败')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: () => {
      // 刷新用户列表
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() })
    },
  })
}
