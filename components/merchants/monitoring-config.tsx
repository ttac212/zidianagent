'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import * as dt from '@/lib/utils/date-toolkit'

interface MonitoringConfigProps {
  merchantId: string
  initialEnabled: boolean
  initialInterval: number
  lastCollectedAt?: Date | string | null
  nextSyncAt?: Date | string | null
}

export function MonitoringConfig({
  merchantId,
  initialEnabled,
  initialInterval,
  lastCollectedAt,
  nextSyncAt,
}: MonitoringConfigProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [interval, setInterval] = useState(String(initialInterval))
  const [updating, setUpdating] = useState(false)

  const formatTime = (date?: Date | string | null) => {
    if (!date) return '暂无'
    const d = dt.parse(date)
    if (!d) return '暂无'
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeAgo = (date?: Date | string | null) => {
    if (!date) return null
    const result = dt.fromNow(date, 'zh-CN')
    return result || null
  }

  const getNextSyncTime = (date?: Date | string | null) => {
    if (!date) return null
    const d = dt.parse(date)
    if (!d) return null
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMs < 0) return '待执行'
    if (diffHours > 0) return `${diffHours}小时后`
    if (diffMins > 0) return `${diffMins}分钟后`
    return '即将执行'
  }

  const handleUpdate = async (newEnabled: boolean, newInterval: string) => {
    if (updating) return // 防止重复请求

    setUpdating(true)
    try {
      const response = await fetch(`/api/merchants/${merchantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitoringEnabled: newEnabled,
          syncIntervalSeconds: Number(newInterval),
          nextSyncAt: newEnabled ? new Date().toISOString() : null, // 启用时立即同步
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新失败')
      }

      toast.success('配置已自动保存', {
        description: newEnabled ? '监控已启用，系统将自动同步数据' : '监控已禁用'
      })

      // 刷新页面以显示最新状态
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      toast.error(error.message || '更新失败')
      // 恢复原状态
      setEnabled(initialEnabled)
      setInterval(String(initialInterval))
    } finally {
      setUpdating(false)
    }
  }

  // 处理开关切换
  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked)
    handleUpdate(checked, interval)
  }

  // 处理频率修改
  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval)
    handleUpdate(enabled, newInterval)
  }

  const intervalOptions = [
    { value: '3600', label: '每小时', description: '适合热门商家，快速捕捉变化' },
    { value: '21600', label: '每6小时（推荐）', description: '平衡同步频率和API成本' },
    { value: '86400', label: '每天', description: '适合更新不频繁的商家' },
    { value: '604800', label: '每周', description: '仅用于低频监控' },
  ]

  return (
    <div className="space-y-6">
      {/* 监控状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>监控状态</CardTitle>
          <CardDescription>查看当前同步状态和历史记录</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 启用状态 */}
            <div className="flex flex-col space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                监控状态
              </div>
              <div>
                <Badge variant={enabled ? 'default' : 'secondary'}>
                  {enabled ? '✓ 已启用' : '○ 已禁用'}
                </Badge>
              </div>
            </div>

            {/* 最后同步 */}
            <div className="flex flex-col space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                最后同步
              </div>
              <div className="text-sm">
                {lastCollectedAt ? (
                  <>
                    <div className="font-medium">{getTimeAgo(lastCollectedAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(lastCollectedAt)}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">暂无记录</span>
                )}
              </div>
            </div>

            {/* 下次同步 */}
            <div className="flex flex-col space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                下次同步
              </div>
              <div className="text-sm">
                {enabled && nextSyncAt ? (
                  <>
                    <div className="font-medium">{getNextSyncTime(nextSyncAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(nextSyncAt)}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>自动同步配置</CardTitle>
          <CardDescription>
            启用后，系统将定期自动同步商家的最新数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">启用自动同步</label>
              <p className="text-xs text-muted-foreground">
                定期从抖音获取最新的商家数据和内容
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={updating}
            />
          </div>

          {/* 同步频率 */}
          {enabled && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">同步频率</label>
                <p className="text-xs text-muted-foreground">
                  选择自动同步的时间间隔
                </p>
              </div>
              <Select
                value={interval}
                onValueChange={handleIntervalChange}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 提示信息 */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">💡 使用提示</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 每次同步最多拉取50个最新视频</li>
              <li>• 只更新新发布和数据变化的内容</li>
              <li>• 同步失败时会自动重试</li>
              <li>• 启用后将立即执行一次同步</li>
              <li>• 配置修改后会自动保存</li>
            </ul>
          </div>

          {/* 更新状态提示 */}
          {updating && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>正在保存配置...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
