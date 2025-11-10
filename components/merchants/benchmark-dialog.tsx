/**
 * 对标账号管理对话框
 * 为商家添加/移除对标账号
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
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Loader2, CheckCircle2, AlertCircle, Target } from 'lucide-react'
import { useMerchantBenchmarks, useAddBenchmark, useRemoveBenchmark } from '@/hooks/api/use-merchant-benchmarks'
import { useMerchantsQuery } from '@/hooks/api/use-merchants-query'
import { toast } from 'sonner'
import * as dt from '@/lib/utils/date-toolkit'

interface BenchmarkDialogProps {
  merchantId: string
  merchantName: string
}

export function BenchmarkDialog({ merchantId, merchantName }: BenchmarkDialogProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Hooks
  const { data: benchmarksData, isLoading: loadingBenchmarks } = useMerchantBenchmarks(merchantId)
  const { data: merchantsData, isLoading: loadingMerchants } = useMerchantsQuery({
    page: 1,
    limit: 100,
    search: searchQuery
  })
  const addBenchmark = useAddBenchmark(merchantId)
  const removeBenchmark = useRemoveBenchmark(merchantId)

  const benchmarks = benchmarksData?.benchmarks || []
  const allMerchants = merchantsData?.merchants || []

  // 过滤掉当前商家和已关联的对标账号
  const benchmarkIds = new Set(benchmarks.map(b => b.benchmark.id))
  const availableMerchants = allMerchants.filter(
    m => m.id !== merchantId && !benchmarkIds.has(m.id)
  )

  // 重置表单
  const resetForm = () => {
    setSelectedBenchmarkId('')
    setNotes('')
    setSearchQuery('')
  }

  // 添加对标账号
  const handleAdd = async () => {
    if (!selectedBenchmarkId) {
      toast.error('请选择对标账号')
      return
    }

    try {
      await addBenchmark.mutateAsync({
        benchmarkId: selectedBenchmarkId,
        notes: notes.trim() || undefined
      })
      toast.success('对标账号添加成功')
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  // 移除对标账号
  const handleRemove = async (benchmarkId: string, benchmarkName: string) => {
    if (!confirm(`确定要移除对标账号"${benchmarkName}"吗？`)) {
      return
    }

    try {
      await removeBenchmark.mutateAsync({ benchmarkId })
      toast.success('对标账号已移除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移除失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Target className="h-4 w-4 mr-2" />
          管理对标账号
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>管理对标账号 - {merchantName}</DialogTitle>
          <DialogDescription>
            为商家添加对标账号，用于学习和参考优秀内容策略
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-6">
          {/* 已关联的对标账号列表 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">当前对标账号 ({benchmarks.length})</Label>
            <ScrollArea className="h-[180px] border rounded-lg">
              {loadingBenchmarks ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  加载中...
                </div>
              ) : benchmarks.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  暂无对标账号
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {benchmarks.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{item.benchmark.name}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {item.benchmark._count?.contents || 0} 视频
                          </Badge>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          添加于 {dt.parse(item.createdAt)?.toLocaleDateString('zh-CN') || '未知'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(item.benchmark.id, item.benchmark.name)}
                        disabled={removeBenchmark.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 添加新对标账号 */}
          <div className="space-y-3 pt-3 border-t">
            <Label className="text-sm font-medium">添加对标账号</Label>

            {/* 搜索商家 */}
            <div className="space-y-2">
              <Label htmlFor="search" className="text-xs">搜索商家</Label>
              <Input
                id="search"
                placeholder="输入商家名称搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* 商家列表 */}
            <ScrollArea className="h-[140px] border rounded-lg">
              {loadingMerchants ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  搜索中...
                </div>
              ) : availableMerchants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                  <AlertCircle className="h-5 w-5 mb-2" />
                  {searchQuery ? '未找到匹配的商家' : '没有可用的商家'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {availableMerchants.map((merchant) => (
                    <button
                      key={merchant.id}
                      onClick={() => setSelectedBenchmarkId(merchant.id)}
                      className={`w-full text-left p-2 rounded-md hover:bg-muted transition-colors ${
                        selectedBenchmarkId === merchant.id ? 'bg-primary/10 border border-primary' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{merchant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {merchant.totalContentCount} 视频 · {merchant.location || '未知地区'}
                          </p>
                        </div>
                        {selectedBenchmarkId === merchant.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* 备注 */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs">备注（可选）</Label>
              <Textarea
                id="notes"
                placeholder="为什么选择这个对标账号？例如：内容风格相似、目标用户一致..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={!selectedBenchmarkId || addBenchmark.isPending}
                className="flex-1"
              >
                {addBenchmark.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    添加中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    添加对标账号
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
