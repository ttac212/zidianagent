/**
 * 推荐Top 3组件
 * 
 * 显示基于规则的文案推荐
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, TrendingUp, UserCheck } from 'lucide-react'
import { getTop3Recommendations, getCopyTypeLabel } from '@/lib/creative/copy-recommendations'

interface Copy {
  id: string
  sequence: number
  markdownContent: string
  state: string
}

interface RecommendedCopiesProps {
  copies: Copy[]
  onScrollToCopy?: (copyId: string) => void
}

const ICON_MAP = {
  1: Star, // 痛点型 - 最抓人
  2: TrendingUp, // 实力型 - 最有说服力
  3: UserCheck // 信任型 - 最易转化
}

export function RecommendedCopies({ copies, onScrollToCopy }: RecommendedCopiesProps) {
  const recommendations = getTop3Recommendations(copies)

  if (recommendations.length === 0) {
    return null
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          推荐 Top 3
          <Badge variant="secondary" className="text-xs">
            基于文案类型智能推荐
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, index) => {
            const Icon = ICON_MAP[index + 1 as keyof typeof ICON_MAP] || Star
            
            return (
              <div 
                key={rec.copyId}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => onScrollToCopy?.(rec.copyId)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      推荐 {index + 1}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {rec.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      文案 {rec.sequence}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {rec.reason}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 <strong>提示：</strong>点击推荐卡片可快速跳转到对应文案。
            这些推荐基于文案类型特点，您可以根据实际需求选择其他文案。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
