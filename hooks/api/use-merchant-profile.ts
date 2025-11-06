/**
 * 商家创作档案 - React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  MerchantProfileResponse,
  GenerateProfileResponse,
  UpdateProfileData,
  MerchantProfile
} from '@/types/merchant'

// Query Keys
export const profileKeys = {
  all: ['merchant-profile'] as const,
  detail: (merchantId: string) => ['merchant-profile', merchantId] as const
}

/**
 * 获取商家档案
 */
export function useMerchantProfile(merchantId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(merchantId || ''),
    queryFn: async () => {
      if (!merchantId) throw new Error('merchantId is required')

      const response = await fetch(`/api/merchants/${merchantId}/profile`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '获取档案失败')
      }

      const data = await response.json()
      return data.data as MerchantProfileResponse
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000    // 10分钟
  })
}

/**
 * 生成或刷新档案
 */
export function useGenerateProfile(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/merchants/${merchantId}/profile/generate`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '生成档案失败')
      }

      const data = await response.json()
      return data.data as GenerateProfileResponse
    },
    onSuccess: (data) => {
      // 更新缓存
      queryClient.setQueryData(
        profileKeys.detail(merchantId),
        (old: MerchantProfileResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            profile: data.profile
          }
        }
      )
    }
  })
}

/**
 * 更新用户编辑部分
 */
export function useUpdateProfile(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await fetch(`/api/merchants/${merchantId}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新档案失败')
      }

      const result = await response.json()
      return result.data.profile as MerchantProfile
    },
    onSuccess: (profile) => {
      // 更新缓存
      queryClient.setQueryData(
        profileKeys.detail(merchantId),
        (old: MerchantProfileResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            profile
          }
        }
      )
    }
  })
}
