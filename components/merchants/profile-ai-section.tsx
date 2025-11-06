/**
 * 商家创作档案 - AI生成内容展示组件
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type {
  ProfileBrief,
  ProfileViralAnalysis,
  ProfileCreativeGuide
} from '@/types/merchant'
import { Lightbulb, TrendingUp, Target, Hash, Clock } from 'lucide-react'

interface ProfileAISectionProps {
  brief: ProfileBrief | null
  viralAnalysis: ProfileViralAnalysis | null
  creativeGuide: ProfileCreativeGuide | null
  aiGeneratedAt?: Date | string | null
  aiModelUsed?: string | null
  aiTokenUsed?: number
}

export function ProfileAISection({
  brief,
  viralAnalysis,
  creativeGuide,
  aiGeneratedAt,
  aiModelUsed,
  aiTokenUsed
}: ProfileAISectionProps) {
  if (!brief && !viralAnalysis && !creativeGuide) {
    return (
      <div className="text-sm text-muted-foreground">
        暂无AI分析数据
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* PART 1: 商家Brief */}
      {brief && (
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
      )}

      {/* PART 2: 爆款分析 */}
      {viralAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              爆款内容分析
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 黄金3秒开头模板 */}
            {viralAnalysis.goldenThreeSeconds && Array.isArray(viralAnalysis.goldenThreeSeconds) && viralAnalysis.goldenThreeSeconds.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">黄金3秒开头模板</h4>
                <div className="space-y-2">
                  {viralAnalysis.goldenThreeSeconds.map((template, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-primary/5 rounded-md text-sm border border-primary/20"
                    >
                      {template}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 情绪点分布 */}
            {viralAnalysis.emotionalTriggers && Object.keys(viralAnalysis.emotionalTriggers).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3">情绪点分布</h4>
                <div className="space-y-3">
                  {Object.entries(viralAnalysis.emotionalTriggers).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{getEmotionLabel(key)}</span>
                        <span className="text-muted-foreground">{value}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 内容形式偏好 */}
            {viralAnalysis.contentFormats && Object.keys(viralAnalysis.contentFormats).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3">内容形式偏好</h4>
                <div className="space-y-3">
                  {Object.entries(viralAnalysis.contentFormats).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{getFormatLabel(key)}</span>
                        <span className="text-muted-foreground">{value}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PART 3: 创作指南 */}
      {creativeGuide && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              创作指南
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 热门话题 */}
            {creativeGuide.trendingTopics && Array.isArray(creativeGuide.trendingTopics) && creativeGuide.trendingTopics.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  热门话题
                </h4>
                <div className="flex flex-wrap gap-2">
                  {creativeGuide.trendingTopics.map((topic, idx) => (
                    <Badge key={idx} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 标签策略 */}
            {creativeGuide.tagStrategy && (
              <div>
                <h4 className="font-medium text-sm mb-2">标签组合策略</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof creativeGuide.tagStrategy === 'string'
                    ? creativeGuide.tagStrategy
                    : JSON.stringify(creativeGuide.tagStrategy, null, 2)
                  }
                </p>
              </div>
            )}

            {/* 发布策略 */}
            {creativeGuide.publishingTips && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  发布策略
                </h4>
                <div className="space-y-1 text-sm">
                  {creativeGuide.publishingTips.bestTime && (
                    <div>
                      <span className="text-muted-foreground">最佳时段:</span>{' '}
                      {creativeGuide.publishingTips.bestTime}
                    </div>
                  )}
                  {creativeGuide.publishingTips.frequency && (
                    <div>
                      <span className="text-muted-foreground">发布频率:</span>{' '}
                      {creativeGuide.publishingTips.frequency}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI元数据 */}
      {aiGeneratedAt && (
        <div className="text-xs text-muted-foreground">
          生成于: {new Date(aiGeneratedAt).toLocaleString('zh-CN')}
          {aiModelUsed && ` | 模型: ${aiModelUsed}`}
          {aiTokenUsed && ` | Token: ${aiTokenUsed}`}
        </div>
      )}
    </div>
  )
}

// 辅助函数: 情绪类型标签
function getEmotionLabel(key: string): string {
  const labels: Record<string, string> = {
    humor: '笑点',
    pain: '痛点',
    satisfaction: '爽点',
    knowledge: '知识点'
  }
  return labels[key] || key
}

// 辅助函数: 内容形式标签
function getFormatLabel(key: string): string {
  const labels: Record<string, string> = {
    monologue: '口播',
    drama: '剧情',
    comparison: '对比',
    tutorial: '教程'
  }
  return labels[key] || key
}
