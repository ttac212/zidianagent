/**
 * 批次状态徽章组件
 */

import { CreativeBatchStatus } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, PlayCircle, AlertCircle, Archive } from 'lucide-react'

interface BatchStatusBadgeProps {
  status: CreativeBatchStatus
  copyCount?: number
  className?: string
}

export function BatchStatusBadge({ status, copyCount: _copyCount, className }: BatchStatusBadgeProps) {
  const config = getStatusConfig(status, _copyCount)

  return (
    <Badge 
      variant={config.variant as any} 
      className={className}
    >
      {config.icon && <config.icon className="mr-1 h-3 w-3" />}
      {config.label}
      {status === 'PARTIAL_SUCCESS' && _copyCount !== undefined && (
        <span className="ml-1 text-xs">({_copyCount}/5)</span>
      )}
    </Badge>
  )
}

function getStatusConfig(status: CreativeBatchStatus, _copyCount?: number) {
  switch (status) {
    case 'QUEUED':
      return {
        label: '排队中',
        variant: 'secondary',
        icon: Clock
      }
    case 'RUNNING':
      return {
        label: '生成中',
        variant: 'default',
        icon: PlayCircle
      }
    case 'SUCCEEDED':
      return {
        label: '生成完成',
        variant: 'success',
        icon: CheckCircle2
      }
    case 'PARTIAL_SUCCESS':
      return {
        label: '部分生成',
        variant: 'warning',
        icon: AlertCircle
      }
    case 'FAILED':
      return {
        label: '生成失败',
        variant: 'destructive',
        icon: AlertCircle
      }
    case 'ARCHIVED':
      return {
        label: '已归档',
        variant: 'outline',
        icon: Archive
      }
    default:
      return {
        label: status,
        variant: 'secondary',
        icon: undefined
      }
  }
}
