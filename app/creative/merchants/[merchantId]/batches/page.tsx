'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { BatchStatusBadge } from '@/components/creative/batch-status-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface Batch {
  id: string
  status: string
  statusVersion: number
  modelId: string
  triggeredBy: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  copyCount: number
  exceptionCount: number
  metadata?: {
    targetSequence?: number
  } | null
}

export default function MerchantBatchesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const merchantId = Array.isArray(params.merchantId)
    ? params.merchantId[0]
    : params.merchantId

  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBatches = useCallback(async () => {
    if (!merchantId) {
      setError('缺少商家信息，无法加载批次列表')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/creative/batches?merchantId=${merchantId}`)

      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`)
      }

      const json = await response.json()

      if (json.success && Array.isArray(json.data)) {
        setBatches(json.data)
      } else {
        throw new Error('响应格式异常')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    if (session && merchantId) {
      fetchBatches()
    }
  }, [session, merchantId, fetchBatches])

  if (!session) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-8">
          <p>请先登录</p>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">批量文案生成</h1>
          <p className="text-sm text-muted-foreground mt-1">
            商家 ID：{merchantId || '未知'}
          </p>
        </div>
        <Button onClick={fetchBatches} variant="outline" size="sm" disabled={!merchantId}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-red-500 bg-red-50">
          <p className="text-red-600">错误: {error}</p>
        </Card>
      )}

      {loading ? (
        <p>加载中...</p>
      ) : batches.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>暂无批次记录</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map(batch => {
            const targetSequence =
              typeof batch.metadata === 'object' && batch.metadata !== null && 'targetSequence' in batch.metadata
                ? (batch.metadata as any).targetSequence as number | undefined
                : undefined

            return (
              <Card key={batch.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <BatchStatusBadge 
                        status={batch.status as any} 
                        copyCount={batch.copyCount}
                      />
                      <code className="text-xs text-muted-foreground">
                        {batch.id}
                      </code>
                      {targetSequence !== undefined && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          单条再生成 #{targetSequence}
                        </span>
                      )}
                    </div>

                    <div className="text-sm space-y-1">
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">模型:</span>
                        <span>{batch.modelId}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">文案数:</span>
                        <span>
                          {batch.copyCount}/5
                          {batch.copyCount < 5 && batch.copyCount > 0 && targetSequence === undefined && (
                            <span className="ml-2 text-yellow-600">
                              (部分生成)
                            </span>
                          )}
                        </span>
                      </div>
                      {batch.exceptionCount > 0 && (
                        <div className="flex gap-4">
                          <span className="text-muted-foreground">异常:</span>
                          <span className="text-red-600">{batch.exceptionCount} 条记录</span>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">创建时间:</span>
                        <span>{new Date(batch.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      {batch.completedAt && (
                        <div className="flex gap-4">
                          <span className="text-muted-foreground">完成时间:</span>
                          <span>{new Date(batch.completedAt).toLocaleString('zh-CN')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/creative/batches/${batch.id}`)}
                    >
                      查看详情
                    </Button>
                  </div>
                </div>

                {/* PARTIAL_SUCCESS 特殊提示 */}
                {batch.status === 'PARTIAL_SUCCESS' && targetSequence === undefined && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>部分成功:</strong> 本批次生成了 {batch.copyCount}/5 条文案。
                      已生成的文案已保存，您可以：
                    </p>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                      <li>使用已生成的 {batch.copyCount} 条文案</li>
                      <li>重新生成缺失的 {5 - batch.copyCount} 条</li>
                      <li>或整批重新生成</li>
                    </ul>
                  </div>
                )}

                {/* FAILED 提示 */}
                {batch.status === 'FAILED' && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      <strong>生成失败:</strong> 请检查输入材料或重试。
                      {batch.exceptionCount > 0 && (
                        <span> 查看异常记录了解详情。</span>
                      )}
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
