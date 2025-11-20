/**
 * 商家创作档案 - React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  MerchantProfileResponse,
  GenerateProfileResponse,
  UpdateProfileData,
  MerchantProfile,
  MerchantProfileVersion
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
 * 转录需求响应类型
 */
export interface TranscriptionRequiredResponse {
  requiresTranscription: true
  error: 'TRANSCRIPTION_REQUIRED'
  message: string
  statusCode: 202
  data: {
    total: number
    missingCount: number
    missingPercentage: number
    contentsToTranscribe: Array<{
      id: string
      title: string
      reason: string
    }>
  }
  hint: string
}

/**
 * 生成档案响应类型（包括正常响应和转录需求响应）
 */
export type GenerateProfileResult = GenerateProfileResponse | TranscriptionRequiredResponse

/**
 * 生成或刷新档案
 */
export function useGenerateProfile(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<GenerateProfileResult> => {
      const response = await fetch(`/api/merchants/${merchantId}/profile/generate`, {
        method: 'POST'
      })

      const data = await response.json()

      // 处理202状态码 - 需要先转录
      if (response.status === 202) {
        return {
          requiresTranscription: true,
          ...data
        } as TranscriptionRequiredResponse
      }

      if (!response.ok) {
        throw new Error(data.message || '生成档案失败')
      }

      return data.data as GenerateProfileResponse
    },
    onSuccess: (data) => {
      // 只有成功生成档案时才更新缓存（跳过转录需求响应）
      if ('requiresTranscription' in data && data.requiresTranscription) {
        return
      }

      // 更新缓存
      queryClient.setQueryData(
        profileKeys.detail(merchantId),
        (old: MerchantProfileResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            profile: (data as GenerateProfileResponse).profile
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

/**
 * 获取档案版本历史
 */
export function useProfileVersions(merchantId?: string) {
  return useQuery({
    queryKey: ['merchant-profile-versions', merchantId],
    queryFn: async () => {
      if (!merchantId) throw new Error('merchantId is required')
      const res = await fetch(`/api/merchants/${merchantId}/profile/versions`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || '获取版本历史失败')
      }
      const data = await res.json()
      return data.data.versions as MerchantProfileVersion[]
    },
    enabled: Boolean(merchantId),
    staleTime: 60 * 1000
  })
}
