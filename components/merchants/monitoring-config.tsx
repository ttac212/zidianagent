'use client'

import { useState, useRef } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

interface MonitoringConfigProps {
  merchantId: string
  initialEnabled: boolean
  initialInterval: number
}

export function MonitoringConfig({
  merchantId,
  initialEnabled,
  initialInterval,
}: MonitoringConfigProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [interval, setInterval] = useState(String(initialInterval))
  const [updating, setUpdating] = useState(false)

  // 使用 ref 保存最后一次成功的配置（作为真相源）
  const lastSuccessfulConfigRef = useRef({
    enabled: initialEnabled,
    interval: String(initialInterval)
  })

  const handleUpdate = async (newEnabled: boolean, newInterval: string) => {
    if (updating) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/merchants/${merchantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitoringEnabled: newEnabled,
          syncIntervalSeconds: Number(newInterval),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新失败')
      }

      // 更新成功后，保存到"最后成功配置"
      lastSuccessfulConfigRef.current = {
        enabled: newEnabled,
        interval: newInterval
      }

      toast.success('配置已保存')
    } catch (error: any) {
      toast.error(error.message || '更新失败')

      // 失败时回滚到最后一次成功的配置（而不是初始值）
      setEnabled(lastSuccessfulConfigRef.current.enabled)
      setInterval(lastSuccessfulConfigRef.current.interval)
    } finally {
      setUpdating(false)
    }
  }

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked)
    handleUpdate(checked, interval)
  }

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval)
    handleUpdate(enabled, newInterval)
  }

  const intervalOptions = [
    { value: '3600', label: '每小时' },
    { value: '21600', label: '每6小时（推荐）' },
    { value: '86400', label: '每天' },
    { value: '604800', label: '每周' },
  ]

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">启用自动同步</label>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={updating}
          />
        </div>

        {/* 同步频率 */}
        {enabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium">同步频率</label>
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
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
