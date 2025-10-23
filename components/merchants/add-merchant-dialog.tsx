/**
 * 添加商家对话框组件
 * 通过抖音主页分享链接添加商家数据
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Plus, Loader2, CheckCircle2, AlertCircle, Link as LinkIcon } from 'lucide-react'
import type { BusinessType } from '@prisma/client'

interface AddMerchantDialogProps {
  onSuccess?: () => void
  categories?: Array<{ id: string; name: string; color?: string | null }>
}

type SyncStatus = 'idle' | 'parsing' | 'syncing' | 'success' | 'error'

interface SyncResult {
  merchantId?: string
  merchantName?: string
  newVideos?: number
  updatedVideos?: number
  totalVideos?: number
  error?: string
}

export function AddMerchantDialog({ onSuccess, categories = [] }: AddMerchantDialogProps) {
  const [open, setOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [businessType, setBusinessType] = useState<BusinessType>('B2C')
  const [maxVideos, setMaxVideos] = useState(100)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [progress, setProgress] = useState(0)

  // 重置表单
  const resetForm = () => {
    setShareLink('')
    setCategoryId('')
    setBusinessType('B2C')
    setMaxVideos(100)
    setStatus('idle')
    setResult(null)
    setProgress(0)
  }

  // 处理提交
  const handleSubmit = async () => {
    if (!shareLink.trim()) {
      setResult({ error: '请输入抖音主页分享链接' })
      setStatus('error')
      return
    }

    try {
      // 步骤1: 解析分享链接
      setStatus('parsing')
      setProgress(20)

      const parseResponse = await fetch('/api/douyin/parse-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareText: shareLink }),
      })

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({ error: '解析失败' }))
        throw new Error(errorData.error || errorData.details || '无法解析分享链接，请检查链接格式')
      }

      const parseData = await parseResponse.json()
      const secUid = parseData.data?.secUserId || parseData.data?.userId

      if (!secUid) {
        throw new Error('未能从分享链接中提取商家ID')
      }

      // 步骤2: 同步商家数据
      setStatus('syncing')
      setProgress(50)

      const syncResponse = await fetch('/api/tikhub/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sec_uid: secUid,
          categoryId: categoryId || undefined,
          businessType,
          maxVideos,
        }),
      })

      setProgress(80)

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json().catch(() => ({ error: '同步失败' }))
        throw new Error(errorData.error || errorData.details || '同步失败')
      }

      const syncData = await syncResponse.json()

      // 步骤3: 完成
      setProgress(100)
      setStatus('success')
      setResult({
        merchantId: syncData.data?.merchantId,
        merchantName: syncData.data?.merchantName,
        newVideos: syncData.data?.newVideos,
        updatedVideos: syncData.data?.updatedVideos,
        totalVideos: syncData.data?.totalVideos,
      })

      // 3秒后关闭对话框并刷新列表
      setTimeout(() => {
        setOpen(false)
        resetForm()
        onSuccess?.()
      }, 3000)

    } catch (error) {
      setStatus('error')
      setProgress(0)
      setResult({
        error: error instanceof Error ? error.message : '同步失败，请稍后重试',
      })
    }
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && status !== 'syncing' && status !== 'parsing') {
      resetForm()
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加商家
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>添加商家数据</DialogTitle>
          <DialogDescription>
            通过抖音主页分享链接自动同步商家资料和作品数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 分享链接输入 */}
          <div className="space-y-2">
            <Label htmlFor="shareLink" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              抖音主页分享链接
            </Label>
            <Input
              id="shareLink"
              placeholder="粘贴抖音主页分享文案或链接..."
              value={shareLink}
              onChange={(e) => setShareLink(e.target.value)}
              disabled={status === 'parsing' || status === 'syncing'}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              示例: https://v.douyin.com/xxx/ 或包含该链接的完整分享文案
            </p>
          </div>

          {/* 分类选择 */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="category">商家分类（可选）</Label>
              <Select value={categoryId || undefined} onValueChange={setCategoryId} disabled={status === 'parsing' || status === 'syncing'}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="不设置分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 业务类型 */}
          <div className="space-y-2">
            <Label htmlFor="businessType">业务类型</Label>
            <Select value={businessType} onValueChange={(v) => setBusinessType(v as BusinessType)} disabled={status === 'parsing' || status === 'syncing'}>
              <SelectTrigger id="businessType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="B2C">B2C - 面向消费者</SelectItem>
                <SelectItem value="B2B">B2B - 面向企业</SelectItem>
                <SelectItem value="B2B2C">B2B2C - 混合模式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 同步视频数量 */}
          <div className="space-y-2">
            <Label htmlFor="maxVideos">同步视频数量</Label>
            <Input
              id="maxVideos"
              type="number"
              min={10}
              max={500}
              value={maxVideos}
              onChange={(e) => setMaxVideos(Number(e.target.value))}
              disabled={status === 'parsing' || status === 'syncing'}
            />
            <p className="text-xs text-muted-foreground">
              建议：100-200条（数量越多耗时越长）
            </p>
          </div>

          {/* 进度条 */}
          {(status === 'parsing' || status === 'syncing') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === 'parsing' ? '正在解析分享链接...' : '正在同步数据...'}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* 成功提示 */}
          {status === 'success' && result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-1">
                  <p className="font-medium">同步成功！</p>
                  <p className="text-sm">
                    商家：{result.merchantName}
                  </p>
                  <p className="text-sm">
                    新增 {result.newVideos} 条，更新 {result.updatedVideos} 条，共 {result.totalVideos} 条视频
                  </p>
                  <p className="text-xs text-green-600 mt-2">3秒后自动关闭...</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 错误提示 */}
          {status === 'error' && result?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={status === 'parsing' || status === 'syncing'}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!shareLink.trim() || status === 'parsing' || status === 'syncing' || status === 'success'}
          >
            {status === 'parsing' || status === 'syncing' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              '开始同步'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
