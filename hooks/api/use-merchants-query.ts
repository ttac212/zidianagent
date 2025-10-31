/**
 * 商家管理 React Query Hooks
 * 统一管理商家数据的查询和缓存
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  MerchantListItem,
  MerchantCategory,
  MerchantStats,
  MerchantFilters,
  CreateMerchantData
} from '@/types/merchant'

// ==================== Query Keys ====================

export const merchantKeys = {
  all: ['merchants'] as const,
  lists: () => [...merchantKeys.all, 'list'] as const,
  list: (filters: MerchantFilters) => [...merchantKeys.lists(), filters] as const,
  stats: () => [...merchantKeys.all, 'stats'] as const,
  categories: () => [...merchantKeys.all, 'categories'] as const,
  detail: (id: string) => [...merchantKeys.all, 'detail', id] as const,
}

// ==================== API Functions ====================

interface MerchantsResponse {
  merchants: MerchantListItem[]
  total: number
}

async function fetchMerchants(filters: MerchantFilters): Promise<MerchantsResponse> {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== '') {
      params.append(key, String(value))
    }
  })

  // 添加时间戳防止浏览器缓存
  params.append('_t', Date.now().toString())

  const response = await fetch(`/api/merchants?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`获取商家列表失败: ${errorText}`)
  }

  return response.json()
}

async function fetchMerchantCategories(): Promise<MerchantCategory[]> {
  const response = await fetch('/api/merchants/categories', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('获取商家分类失败')
  }

  return response.json()
}

interface StatsResponse {
  stats: MerchantStats
}

async function fetchMerchantStats(): Promise<MerchantStats> {
  const response = await fetch('/api/merchants/stats', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('获取商家统计失败')
  }

  const data: StatsResponse = await response.json()
  return data.stats
}

async function createMerchant(data: CreateMerchantData): Promise<MerchantListItem> {
  const response = await fetch('/api/merchants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`创建商家失败: ${errorText}`)
  }

  return response.json()
}

// ==================== Query Hooks ====================

/**
 * 获取商家列表
 */
export function useMerchantsQuery(filters: MerchantFilters) {
  return useQuery({
    queryKey: merchantKeys.list(filters),
    queryFn: () => fetchMerchants(filters),
    staleTime: 2 * 60 * 1000, // 2分钟
    gcTime: 5 * 60 * 1000,    // 5分钟
  })
}

/**
 * 获取商家分类
 */
export function useMerchantCategoriesQuery() {
  return useQuery({
    queryKey: merchantKeys.categories(),
    queryFn: fetchMerchantCategories,
    staleTime: 10 * 60 * 1000, // 10分钟（分类数据变化不频繁）
    gcTime: 30 * 60 * 1000,    // 30分钟
  })
}

/**
 * 获取商家统计数据
 */
export function useMerchantStatsQuery() {
  return useQuery({
    queryKey: merchantKeys.stats(),
    queryFn: fetchMerchantStats,
    staleTime: 5 * 60 * 1000,  // 5分钟
    gcTime: 10 * 60 * 1000,    // 10分钟
  })
}

// ==================== Mutation Hooks ====================

/**
 * 创建商家 Mutation
 */
export function useCreateMerchantMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createMerchant,
    onSuccess: (newMerchant) => {
      // 使 predicate 匹配所有商家列表查询
      queryClient.setQueriesData({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) &&
            key[0] === 'merchants' &&
            key[1] === 'list'
        }
      }, (oldData: MerchantsResponse | undefined) => {
        if (!oldData) return { merchants: [newMerchant], total: 1 }
        return {
          merchants: [newMerchant, ...oldData.merchants],
          total: oldData.total + 1
        }
      })

      // 失效统计数据，触发重新获取
      queryClient.invalidateQueries({ queryKey: merchantKeys.stats() })
    },
  })
}

// ==================== Helper Functions ====================

/**
 * 刷新所有商家数据
 */
export function useInvalidateMerchants() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: merchantKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: merchantKeys.lists() }),
    invalidateStats: () => queryClient.invalidateQueries({ queryKey: merchantKeys.stats() }),
    invalidateCategories: () => queryClient.invalidateQueries({ queryKey: merchantKeys.categories() }),
  }
}
