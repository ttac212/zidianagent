/**
 * 批次详情页面
 * 
 * 功能：
 * - 显示批次信息和状态
 * - 展示文案列表（Grid 布局）
 * - SSE 实时状态推送
 * - 编辑文案
 * - 单条重新生成
 * - 整批重新生成
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthGuard } from '@/components/creative/auth-guard'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BatchInfoCard } from '@/components/creative/batch-info-card'
import { CopyCard } from '@/components/creative/copy-card'
import { CopyEditDialog } from '@/components/creative/copy-edit-dialog'
import { CopyRegenerateDialog } from '@/components/creative/copy-regenerate-dialog'
import { CopyVersionHistoryDialog } from '@/components/creative/copy-version-history-dialog'
import { BatchRegenerateDialog } from '@/components/creative/batch-regenerate-dialog'
import { BatchActionsDialog } from '@/components/creative/batch-actions-dialog'
import { RecommendedCopies } from '@/components/creative/recommended-copies'
import { useBatchStatusSSE } from '@/hooks/use-batch-status-sse'
import { ArrowLeft, AlertCircle, RefreshCw, Archive, Trash2, Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Copy {
  id: string
  sequence: number
  markdownContent: string
  state: string
  contentVersion: number
  editedAt?: string | null
}

interface BatchDetail {
  id: string
  merchantId: string
  status: string
  statusVersion: number
  modelId: string
  triggeredBy: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  errorMessage?: string | null
  tokenUsage?: any
  copyCount: number
  copies: Copy[]
  metadata?: {
    targetSequence?: number | null
    appendPrompt?: string | null
    parentCopyId?: string | null
  } | null
  parentBatch?: {
    id: string
    status: string
    createdAt: string
  } | null
}

export default function BatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const batchId = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId

  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const listPath = batch?.merchantId
    ? `/creative/merchants/${batch.merchantId}/batches`
    : '/creative'

  // 编辑对话框状态
  const [editingCopy, setEditingCopy] = useState<Copy | null>(null)
  
  // 重新生成对话框状态
  const [regeneratingCopy, setRegeneratingCopy] = useState<Copy | null>(null)
  
  // 版本历史对话框状态
  const [historyViewingCopyId, setHistoryViewingCopyId] = useState<string | null>(null)
  
  // 整批重新生成对话框状态
  const [batchRegenerateOpen, setBatchRegenerateOpen] = useState(false)
  
  // 批次操作对话框状态
  const [batchAction, setBatchAction] = useState<{ action: 'archive' | 'delete' | null; batchId: string | null }>({
    action: null,
    batchId: null
  })

  // SSE 实时推送
  const { isConnected } = useBatchStatusSSE({
    batchId: batchId || '',
    enabled: !!batchId && !!batch,
    onStatusUpdate: (event) => {
      // 更新批次状态
      setBatch(prev => prev ? {
        ...prev,
        status: event.status,
        statusVersion: event.statusVersion,
        startedAt: event.startedAt,
        completedAt: event.completedAt,
        errorMessage: event.errorMessage,
        tokenUsage: event.tokenUsage,
        copyCount: event.copyCount
      } : null)
      
      // 如果文案数量变化，重新加载
      if (event.copyCount > (batch?.copyCount || 0)) {
        fetchBatchDetail()
      }
    },
    onComplete: (event) => {
      toast.success(`批次已完成：${event.finalStatus}`)
      fetchBatchDetail()
    },
    onError: () => {
      toast.error('实时推送连接错误')
    }
  })

  // 加载批次详情
  const fetchBatchDetail = useCallback(async () => {
    if (!batchId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/creative/batches/${batchId}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `加载失败 (${response.status})`)
      }

      const json = await response.json()
      
      // Linus: "标准响应是 { success, data }, 别再直接 setBatch(data) 了"
      if (json.success && json.data) {
        setBatch(json.data as BatchDetail)
      } else {
        throw new Error('响应格式异常')
      }
    } catch (err: any) {
      console.error('[BatchDetail] Load failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    fetchBatchDetail()
  }, [fetchBatchDetail])

  // 保存编辑
  const handleSaveEdit = async (copyId: string, content: string, note?: string) => {
    try {
      const response = await fetch(`/api/creative/copies/${copyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, note })
      })

      if (!response.ok) {
        throw new Error('保存失败')
      }

      toast.success('保存成功')
      fetchBatchDetail() // 重新加载
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 单条重新生成
  const handleRegenerateSingle = async (
    copyId: string, 
    mode: 'based-on-current' | 'fresh',
    appendPrompt?: string
  ) => {
    try {
      const response = await fetch(`/api/creative/copies/${copyId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          appendPrompt,
          note: `单条重新生成（${mode === 'fresh' ? '完全重新' : '基于当前改进'}）`
        })
      })

      if (!response.ok) {
        throw new Error('重新生成失败')
      }

      const data = await response.json()
      toast.success('已开始生成，请稍候...')
      
      // 跳转到新批次
      router.push(`/creative/batches/${data.batchId}`)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 整批重新生成
  const handleRegenerateAll = async (appendPrompt?: string) => {
    if (!batch) return

    try {
      const response = await fetch(`/api/creative/batches/${batch.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appendPrompt: appendPrompt || undefined
        })
      })

      if (!response.ok) {
        throw new Error('重新生成失败')
      }

      const data = await response.json()
      toast.success('已创建新批次，正在生成...')
      
      // 跳转到新批次
      router.push(`/creative/batches/${data.batchId}`)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 更新文案状态
  const handleUpdateState = async (copyId: string, state: string) => {
    try {
      const response = await fetch(`/api/creative/copies/${copyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      })

      if (!response.ok) {
        throw new Error('更新失败')
      }

      toast.success('状态已更新')
      fetchBatchDetail()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // 批次操作（归档/删除）
  const handleBatchAction = async (batchId: string, action: 'archive' | 'delete') => {
    try {
      if (action === 'archive') {
        const response = await fetch(`/api/creative/batches/${batchId}/archive`, {
          method: 'POST'
        })

        if (!response.ok) {
          throw new Error('归档失败')
        }

        toast.success('已归档')
        router.push(listPath)
      } else if (action === 'delete') {
        const response = await fetch(`/api/creative/batches/${batchId}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('删除失败')
        }

        toast.success('已删除')
      router.push(listPath)
      }
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 导出批次（Markdown）
  const handleExport = () => {
    if (!batch) return

    const content = batch.copies
      .sort((a, b) => a.sequence - b.sequence)
      .map(copy => {
        const stateLabel = copy.state === 'APPROVED' ? '✅' : copy.state === 'REJECTED' ? '❌' : '📝'
        return `## 文案 ${copy.sequence} ${stateLabel}\n\n${copy.markdownContent}\n\n---\n`
      })
      .join('\n')

    const header = `# 批次文案导出\n\n批次ID: ${batch.id}\n模型: ${batch.modelId}\n创建时间: ${new Date(batch.createdAt).toLocaleString('zh-CN')}\n文案数量: ${batch.copies.length}/5\n\n---\n\n`

    const blob = new Blob([header + content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-${batch.id}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('导出成功')
  }

  return (
    <AuthGuard>
      <Header />
      
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        {/* 面包屑导航 + 操作菜单 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={listPath}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                批次列表
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">批次详情</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                更多操作
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                导出 Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setBatchAction({ action: 'archive', batchId: batchId || null })}>
                <Archive className="mr-2 h-4 w-4" />
                归档批次
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setBatchAction({ action: 'delete', batchId: batchId || null })}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除批次
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                onClick={fetchBatchDetail}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 批次内容 */}
        {batch && !loading && (
          <>
            {/* 批次信息卡片 */}
            <BatchInfoCard 
              batch={batch}
              onRegenerateAll={() => setBatchRegenerateOpen(true)}
            />

            {batch.metadata?.targetSequence !== undefined && (
              <Alert className="border-dashed">
                <AlertTitle>单条再生成批次</AlertTitle>
                <AlertDescription>
                  {batch.parentBatch ? (
                    <span>
                      该批次来自
                      <Link className="ml-1 underline" href={`/creative/batches/${batch.parentBatch.id}`}>
                        批次 {batch.parentBatch.id}
                      </Link>
                      的第 {batch.metadata.targetSequence} 条文案再生成结果。
                    </span>
                  ) : (
                    <span>该批次为第 {batch.metadata.targetSequence} 条文案的再生成结果。</span>
                  )}
                  {batch.metadata.appendPrompt && (
                    <span className="block mt-2 text-muted-foreground">
                      补充提示：{batch.metadata.appendPrompt}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 文案列表 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  生成的文案 ({batch.copies.length}/5)
                </h2>
                {isConnected && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    实时连接
                  </div>
                )}
              </div>

              {batch.copies.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    {batch.status === 'RUNNING' || batch.status === 'QUEUED' 
                      ? '正在生成文案，请稍候...' 
                      : '暂无文案'}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {/* 推荐Top 3 */}
                  {batch.copies.length >= 3 && (
                    <RecommendedCopies 
                      copies={batch.copies}
                      onScrollToCopy={(copyId) => {
                        const element = document.getElementById(`copy-${copyId}`)
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                    />
                  )}

                  {/* 文案网格 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {batch.copies
                      .sort((a, b) => a.sequence - b.sequence)
                      .map(copy => (
                        <div key={copy.id} id={`copy-${copy.id}`}>
                          <CopyCard
                            copy={copy}
                            onEdit={() => setEditingCopy(copy)}
                            onRegenerate={() => setRegeneratingCopy(copy)}
                            onUpdateState={handleUpdateState}
                            onViewHistory={(copyId) => setHistoryViewingCopyId(copyId)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 编辑对话框 */}
      <CopyEditDialog
        open={!!editingCopy}
        copy={editingCopy}
        onClose={() => setEditingCopy(null)}
        onSave={handleSaveEdit}
      />

      {/* 重新生成对话框 */}
      <CopyRegenerateDialog
        open={!!regeneratingCopy}
        copy={regeneratingCopy}
        onClose={() => setRegeneratingCopy(null)}
        onRegenerate={handleRegenerateSingle}
      />

      {/* 版本历史对话框 */}
      <CopyVersionHistoryDialog
        open={!!historyViewingCopyId}
        copyId={historyViewingCopyId}
        onClose={() => setHistoryViewingCopyId(null)}
      />

      {/* 整批重新生成对话框 */}
      <BatchRegenerateDialog
        open={batchRegenerateOpen}
        batch={batch ? {
          id: batch.id,
          modelId: batch.modelId,
          copyCount: batch.copyCount
        } : null}
        onClose={() => setBatchRegenerateOpen(false)}
        onRegenerate={handleRegenerateAll}
      />

      {/* 批次操作对话框 */}
      <BatchActionsDialog
        open={!!batchAction.action}
        action={batchAction.action}
        batchId={batchAction.batchId}
        onClose={() => setBatchAction({ action: null, batchId: null })}
        onConfirm={handleBatchAction}
      />
    </AuthGuard>
  )
}
