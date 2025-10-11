/**
 * 资料版本卡片
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Edit, CheckCircle } from 'lucide-react'
import { toLocal } from '@/lib/utils/date-toolkit'

interface AssetVersionCardProps {
  asset: {
    id: string
    type: string
    title: string
    version: number
    isActive: boolean
    content: string
    createdAt: string
    createdBy?: string | null
  }
  onView?: (assetId: string) => void
  onEdit?: (assetId: string) => void
  onSetActive?: (assetId: string) => void
}

export function AssetVersionCard({ 
  asset, 
  onView, 
  onEdit, 
  onSetActive 
}: AssetVersionCardProps) {
  const contentPreview = asset.content.slice(0, 150) + (asset.content.length > 150 ? '...' : '')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {asset.title}
            {asset.isActive && (
              <Badge variant="success">当前版本</Badge>
            )}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            v{asset.version}
          </div>
        </div>
        <CardDescription>
          创建于 {toLocal(new Date(asset.createdAt), 'zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
          {asset.createdBy && ` | 创建人: ${asset.createdBy}`}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {contentPreview}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onView?.(asset.id)}
          >
            <Eye className="mr-1 h-4 w-4" />
            查看
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit?.(asset.id)}
          >
            <Edit className="mr-1 h-4 w-4" />
            编辑
          </Button>
          
          {!asset.isActive && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => onSetActive?.(asset.id)}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              设为当前版本
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
