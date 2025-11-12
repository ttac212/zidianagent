/**
 * 商家创作档案 - AI生成内容展示组件
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProfileBrief } from '@/types/merchant'
import { Target } from 'lucide-react'
import * as dt from '@/lib/utils/date-toolkit'

interface ProfileAISectionProps {
  brief: ProfileBrief | null
  aiGeneratedAt?: Date | string | null
  aiModelUsed?: string | null
  aiTokenUsed?: number
}

export function ProfileAISection({
  brief,
  aiGeneratedAt,
  aiModelUsed,
  aiTokenUsed
}: ProfileAISectionProps) {
  if (!brief) {
    return (
      <div className="text-sm text-muted-foreground">
        暂无AI分析数据
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 商家Brief */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            商家Brief(创作简报)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 介绍 */}
          {brief.intro && (
            <div>
              <h4 className="font-medium text-sm mb-2">商家介绍</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {brief.intro}
              </p>
            </div>
          )}

          {/* 核心卖点 */}
          {brief.sellingPoints && Array.isArray(brief.sellingPoints) && brief.sellingPoints.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">核心卖点</h4>
              <ul className="list-disc list-inside space-y-1">
                {brief.sellingPoints.map((point, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 使用场景 */}
          {brief.usageScenarios && Array.isArray(brief.usageScenarios) && brief.usageScenarios.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">使用场景</h4>
              <ul className="list-disc list-inside space-y-1">
                {brief.usageScenarios.map((scenario, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    {scenario}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 用户画像 */}
          {brief.audienceProfile && (
            <div>
              <h4 className="font-medium text-sm mb-2">目标用户画像</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">年龄:</span>{' '}
                  <span>{brief.audienceProfile.age}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">性别:</span>{' '}
                  <span>{brief.audienceProfile.gender}</span>
                </div>
                {brief.audienceProfile.interests && Array.isArray(brief.audienceProfile.interests) && brief.audienceProfile.interests.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">兴趣:</span>{' '}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brief.audienceProfile.interests.map((interest, idx) => (
                        <Badge key={idx} variant="secondary">{interest}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {brief.audienceProfile.behaviors && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">消费习惯:</span>{' '}
                    <span>{brief.audienceProfile.behaviors}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 品牌调性 */}
          {brief.brandTone && (
            <div>
              <h4 className="font-medium text-sm mb-2">品牌调性</h4>
              <Badge variant="outline">{brief.brandTone}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI元数据 */}
      {aiGeneratedAt && (
        <div className="text-xs text-muted-foreground">
          生成于: {dt.parse(aiGeneratedAt)?.toLocaleString('zh-CN') ?? '未知'}
          {aiModelUsed && ` | 模型: ${aiModelUsed}`}
          {aiTokenUsed && ` | Token: ${aiTokenUsed}`}
        </div>
      )}
    </div>
  )
}
