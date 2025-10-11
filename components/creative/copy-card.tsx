/**
 * 文案卡片
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Copy, Edit, RefreshCw, MoreHorizontal, CheckCircle, XCircle, History } from 'lucide-react'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { toast } from 'sonner'

interface CopyCardProps {
  copy: {
    id: string
    sequence: number
    markdownContent: string
    state: string
    contentVersion: number
    editedAt?: string | null
  }
  onEdit?: (copyId: string) => void
  onRegenerate?: (copyId: string) => void
  onUpdateState?: (copyId: string, state: string) => void
  onViewHistory?: (copyId: string) => void
}

const STATE_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  APPROVED: '已通过',
  REJECTED: '已拒绝'
}

const STATE_VARIANTS: Record<string, 'secondary' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  APPROVED: 'success',
  REJECTED: 'destructive'
}

export function CopyCard({ copy, onEdit, onRegenerate, onUpdateState, onViewHistory }: CopyCardProps) {
  const [copying, setCopying] = useState(false)

  const handleCopy = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(copy.markdownContent)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    } finally {
      setCopying(false)
    }
  }

  return (
    <Card className="relative group h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            文案 {copy.sequence}
          </CardTitle>
          <Badge variant={STATE_VARIANTS[copy.state]}>
            {STATE_LABELS[copy.state]}
          </Badge>
        </div>
        {copy.contentVersion > 1 && (
          <div className="text-xs text-muted-foreground">
            版本 v{copy.contentVersion}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Markdown 预览 */}
        <div className="prose prose-sm max-w-none mb-4 flex-1 overflow-auto">
          <SecureMarkdown content={copy.markdownContent} />
        </div>
        
        <Separator className="my-4" />
        
        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCopy}
            disabled={copying}
          >
            <Copy className="mr-1 h-4 w-4" />
            复制
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit?.(copy.id)}
          >
            <Edit className="mr-1 h-4 w-4" />
            编辑
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onRegenerate?.(copy.id)}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            重新生成
          </Button>
          
          {/* 更多操作 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onUpdateState?.(copy.id, 'APPROVED')}
                disabled={copy.state === 'APPROVED'}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                标记为通过
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onUpdateState?.(copy.id, 'REJECTED')}
                disabled={copy.state === 'REJECTED'}
              >
                <XCircle className="mr-2 h-4 w-4" />
                标记为拒绝
              </DropdownMenuItem>
              {copy.contentVersion > 1 && (
                <DropdownMenuItem 
                  onClick={() => onViewHistory?.(copy.id)}
                >
                  <History className="mr-2 h-4 w-4" />
                  版本历史
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
