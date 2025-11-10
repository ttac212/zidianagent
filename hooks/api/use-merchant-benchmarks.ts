/**
 * 商家对标账号 - React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  MerchantBenchmarksResponse,
  MerchantBenchmark,
  AddBenchmarkData,
  RemoveBenchmarkData
} from '@/types/merchant'

// Query Keys
export const benchmarkKeys = {
  all: ['merchant-benchmarks'] as const,
  list: (merchantId: string) => ['merchant-benchmarks', merchantId] as const
}

/**
 * 获取商家的所有对标账号
 */
export function useMerchantBenchmarks(merchantId: string | undefined) {
  return useQuery({
    queryKey: benchmarkKeys.list(merchantId || ''),
    queryFn: async () => {
      if (!merchantId) throw new Error('merchantId is required')

      const response = await fetch(`/api/merchants/${merchantId}/benchmarks`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '获取对标账号失败')
      }

      const data = await response.json()
      return data.data as MerchantBenchmarksResponse
    },
    enabled: !!merchantId,
    staleTime: 2 * 60 * 1000, // 2分钟
    gcTime: 5 * 60 * 1000     // 5分钟
  })
}

/**
 * 添加对标账号关联
 */
export function useAddBenchmark(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: AddBenchmarkData) => {
      const response = await fetch(`/api/merchants/${merchantId}/benchmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '添加对标账号失败')
      }

      const result = await response.json()
      return result.data.benchmark as MerchantBenchmark
    },
    onSuccess: (newBenchmark) => {
      // 更新缓存：添加新的对标账号到列表
      queryClient.setQueryData(
        benchmarkKeys.list(merchantId),
        (old: MerchantBenchmarksResponse | undefined) => {
          if (!old) {
            return { benchmarks: [newBenchmark] }
          }
          return {
            ...old,
            benchmarks: [newBenchmark, ...old.benchmarks]
          }
        }
      )
    }
  })
}

/**
 * 删除对标账号关联
 */
export function useRemoveBenchmark(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: RemoveBenchmarkData) => {
      const response = await fetch(`/api/merchants/${merchantId}/benchmarks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '删除对标账号失败')
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: (_data, variables) => {
      // 更新缓存：从列表中移除对标账号
      queryClient.setQueryData(
        benchmarkKeys.list(merchantId),
        (old: MerchantBenchmarksResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            benchmarks: old.benchmarks.filter(
              b => b.benchmark.id !== variables.benchmarkId
            )
          }
        }
      )
    }
  })
}

/**
 * 更新对标账号备注
 */
export function useUpdateBenchmarkNotes(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ benchmarkId, notes }: { benchmarkId: string; notes: string }) => {
      // 先删除旧关联，再创建新关联（因为没有 PATCH 端点）
      await fetch(`/api/merchants/${merchantId}/benchmarks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmarkId })
      })

      const response = await fetch(`/api/merchants/${merchantId}/benchmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmarkId, notes })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新备注失败')
      }

      const result = await response.json()
      return result.data.benchmark as MerchantBenchmark
    },
    onSuccess: (updatedBenchmark) => {
      // 更新缓存：替换对应的对标账号
      queryClient.setQueryData(
        benchmarkKeys.list(merchantId),
        (old: MerchantBenchmarksResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            benchmarks: old.benchmarks.map(b =>
              b.benchmark.id === updatedBenchmark.benchmark.id ? updatedBenchmark : b
            )
          }
        }
      )
    }
  })
}
