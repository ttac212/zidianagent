/**
 * 商家创作档案 - 用户自定义内容展示组件
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MerchantProfile } from '@/types/merchant'
import { FileText } from 'lucide-react'

interface ProfileCustomSectionProps {
  profile: MerchantProfile | null
}

export function ProfileCustomSection({ profile }: ProfileCustomSectionProps) {
  const hasCustomContent = profile && (
    profile.customBackground ||
    profile.customOfflineInfo ||
    profile.customProductDetails ||
    profile.customDosAndDonts
  )

  if (!hasCustomContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            人工补充信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            暂无人工补充信息。点击[编辑]按钮添加。
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          人工补充信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile.customBackground && (
          <InfoRow
            label="商家背景故事"
            value={profile.customBackground}
          />
        )}

        {profile.customOfflineInfo && (
          <InfoRow
            label="线下信息"
            value={profile.customOfflineInfo}
          />
        )}

        {profile.customProductDetails && (
          <InfoRow
            label="产品详细信息"
            value={profile.customProductDetails}
          />
        )}

        {profile.customDosAndDonts && (
          <InfoRow
            label="禁忌与必强调点"
            value={profile.customDosAndDonts}
          />
        )}
      </CardContent>
    </Card>
  )
}

// 信息行组件
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-1">{label}</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {value}
      </p>
    </div>
  )
}
