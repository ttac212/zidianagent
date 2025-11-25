/**
 * 商家管理 React Query Hooks
 * 统一管理商家数据的查询和缓存
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { unwrapApiResponse } from '@/lib/api/http-response'
import type {
  MerchantListItem,
  MerchantCategory,
  MerchantStats,
  MerchantFilters,
  CreateMerchantData,
  MerchantWithDetails,
  MerchantDetailResponse,
  MerchantContent,
  ContentListResponse,
  ContentFilters
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

  // 移除 cache: 'no-store'，让 Next.js 使用默认缓存策略
  // React Query 的 staleTime 会控制数据新鲜度
  const response = await fetch(`/api/merchants?${params.toString()}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`获取商家列表失败: ${errorText}`)
  }

  return response.json()
}

async function fetchMerchantCategories(): Promise<MerchantCategory[]> {
  // 分类数据几乎不变，可以使用浏览器缓存
  const response = await fetch('/api/merchants/categories')

  if (!response.ok) {
    throw new Error('获取商家分类失败')
  }

  return response.json()
}

interface StatsResponse {
  stats: MerchantStats
}

async function fetchMerchantStats(): Promise<MerchantStats> {
  // 统计数据可以容忍几分钟的延迟
  const response = await fetch('/api/merchants/stats')

  if (!response.ok) {
    throw new Error('获取商家统计失败')
  }

  const data: StatsResponse = await response.json()
  return data.stats
}

async function fetchMerchantDetail(id: string, signal?: AbortSignal): Promise<MerchantWithDetails> {
  const response = await fetch(`/api/merchants/${id}?includeContents=false`, {
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`��ȡ�̼���Ϣʧ��: ${errorText}`)
  }

  const result = await response.json()
  const data = unwrapApiResponse<MerchantDetailResponse>(result)
  return data.merchant
}

export type MerchantContentQueryFilters = Omit<ContentFilters, 'merchantId'>

function buildContentParams(filters: MerchantContentQueryFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.append('search', filters.search)
  if (filters.contentType) params.append('contentType', filters.contentType)
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toString())
  if (filters.dateTo) params.append('dateTo', filters.dateTo.toString())
  if (typeof filters.hasTranscript === 'boolean') {
    params.append('hasTranscript', String(filters.hasTranscript))
  }
  if (typeof filters.minEngagement === 'number') {
    params.append('minEngagement', String(filters.minEngagement))
  }
  if (filters.sortBy) params.append('sortBy', filters.sortBy as string)
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder as string)
  if (filters.page) params.append('page', String(filters.page))
  if (filters.limit) params.append('limit', String(filters.limit))
  return params
}

async function fetchMerchantContents(
  merchantId: string,
  filters: MerchantContentQueryFilters,
  signal?: AbortSignal
): Promise<ContentListResponse> {
  const params = buildContentParams(filters)
  const response = await fetch(`/api/merchants/${merchantId}/contents?${params.toString()}`, {
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`��ȡ�����б�ʧ��: ${errorText}`)
  }

  const result = await response.json()
  return unwrapApiResponse<ContentListResponse>(result)
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
    staleTime: 5 * 60 * 1000,  // 5分钟（商家数据变化不频繁）
    gcTime: 10 * 60 * 1000,    // 10分钟
  })
}

/**
 * 获取商家分类
 */
export function useMerchantCategoriesQuery() {
  return useQuery({
    queryKey: merchantKeys.categories(),
    queryFn: fetchMerchantCategories,
    staleTime: 30 * 60 * 1000, // 30分钟（分类几乎不变）
    gcTime: 60 * 60 * 1000,    // 1小时
  })
}

/**
 * 获取商家统计数据
 */
export function useMerchantStatsQuery() {
  return useQuery({
    queryKey: merchantKeys.stats(),
    queryFn: fetchMerchantStats,
    staleTime: 10 * 60 * 1000, // 10分钟
    gcTime: 20 * 60 * 1000,    // 20分钟
  })
}

export function useMerchantDetailQuery(merchantId?: string) {
  const enabled = Boolean(merchantId)
  return useQuery({
    queryKey: ['merchant-detail', merchantId ?? 'unknown'],
    queryFn: ({ signal }) => fetchMerchantDetail(merchantId!, signal),
    enabled,
    staleTime: 5 * 60 * 1000,  // 5分钟
    gcTime: 10 * 60 * 1000,    // 10分钟
  })
}

export function useMerchantContentsQuery(
  merchantId: string | undefined,
  filters: MerchantContentQueryFilters
) {
  const enabled = Boolean(merchantId)
  return useQuery({
    queryKey: ['merchant-contents', merchantId ?? 'unknown', filters],
    queryFn: ({ signal }) => fetchMerchantContents(merchantId!, filters, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,  // 3分钟
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
