/**
 * 商家资料管理页面
 * 
 * 功能：
 * - Tabs 切换（商家报告 | 提示词模板）
 * - 版本列表展示
 * - 创建/编辑/查看资料
 * - 设置当前版本
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AssetVersionCard } from '@/components/creative/asset-version-card'
import { CreateAssetDialog } from '@/components/creative/create-asset-dialog'
import { AssetViewDialog } from '@/components/creative/asset-view-dialog'
import { ArrowLeft, Plus, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Asset {
  id: string
  type: string
  title: string
  version: number
  isActive: boolean
  content: string
  createdAt: string
  createdBy?: string | null
}

type AssetType = 'REPORT' | 'PROMPT' | 'ATTACHMENT'

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  REPORT: '商家报告',
  PROMPT: '提示词模板',
  ATTACHMENT: '附件素材'
}

export default function MerchantAssetsPage() {
  const params = useParams()
  const merchantId = Array.isArray(params.merchantId) ? params.merchantId[0] : params.merchantId

  const [activeTab, setActiveTab] = useState<AssetType>('REPORT')
  const [assets, setAssets] = useState<Record<AssetType, Asset[]>>({
    REPORT: [],
    PROMPT: [],
    ATTACHMENT: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null)

  // 加载资料列表
  const fetchAssets = useCallback(async (type?: AssetType) => {
    if (!merchantId) return

    const typesToFetch = type ? [type] : ['REPORT', 'PROMPT', 'ATTACHMENT'] as AssetType[]

    try {
      if (!type) setLoading(true)
      setError(null)

      for (const assetType of typesToFetch) {
        const response = await fetch(
          `/api/creative/merchants/${merchantId}/assets?type=${assetType}`
        )
        
        if (!response.ok) {
          throw new Error(`加载${ASSET_TYPE_LABELS[assetType]}失败`)
        }

        const data = await response.json()
        setAssets(prev => ({
          ...prev,
          [assetType]: data.assets || []
        }))
      }
    } catch (err: any) {
      console.error('[MerchantAssets] Load failed:', err)
      setError(err.message)
    } finally {
      if (!type) setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // 创建资料
  const handleCreate = async (data: {
    title: string
    content: string
    setAsActive: boolean
  }) => {
    try {
      const response = await fetch(
        `/api/creative/merchants/${merchantId}/assets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: activeTab,
            title: data.title,
            content: data.content,
            isActive: data.setAsActive
          })
        }
      )

      if (!response.ok) {
        throw new Error('创建失败')
      }

      toast.success('创建成功')
      fetchAssets(activeTab)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 编辑资料（创建新版本）
  const handleEdit = async (data: {
    title: string
    content: string
    setAsActive: boolean
  }) => {
    if (!editingAsset) return

    try {
      const response = await fetch(
        `/api/creative/merchants/${merchantId}/assets/${editingAsset.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            content: data.content,
            isActive: data.setAsActive
          })
        }
      )

      if (!response.ok) {
        throw new Error('保存失败')
      }

      toast.success('保存成功')
      fetchAssets(activeTab)
      setEditingAsset(null)
    } catch (err: any) {
      toast.error(err.message)
      throw err
    }
  }

  // 设置当前版本
  const handleSetActive = async (assetId: string) => {
    try {
      const response = await fetch(
        `/api/creative/merchants/${merchantId}/assets/${assetId}/activate`,
        {
          method: 'POST'
        }
      )

      if (!response.ok) {
        throw new Error('设置失败')
      }

      toast.success('已设为当前版本')
      fetchAssets(activeTab)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // 查看资料
  const handleView = (assetId: string) => {
    const asset = assets[activeTab].find(a => a.id === assetId)
    if (asset) {
      setViewingAsset(asset)
    }
  }

  // 编辑资料
  const handleEditClick = (assetId: string) => {
    const asset = assets[activeTab].find(a => a.id === assetId)
    if (asset) {
      setEditingAsset(asset)
    }
  }

  return (
    <>
      <Header />
      
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-2">
          <Link href={merchantId ? `/creative/merchants/${merchantId}/batches` : '/creative'}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              批次列表
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">资料管理</span>
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">商家资料管理</h1>
          {activeTab !== 'ATTACHMENT' && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新建{ASSET_TYPE_LABELS[activeTab]}
            </Button>
          )}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
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
                onClick={() => fetchAssets()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs 内容 */}
        {!loading && !error && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType)}>
            <TabsList>
              <TabsTrigger value="REPORT">商家报告</TabsTrigger>
              <TabsTrigger value="PROMPT">提示词模板</TabsTrigger>
              <TabsTrigger value="ATTACHMENT">附件素材</TabsTrigger>
            </TabsList>
            
            <TabsContent value="REPORT" className="space-y-4 mt-4">
              {assets.REPORT.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    暂无商家报告，点击右上角按钮创建
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assets.REPORT
                    .sort((a, b) => b.version - a.version)
                    .map(asset => (
                      <AssetVersionCard
                        key={asset.id}
                        asset={asset}
                        onView={handleView}
                        onEdit={handleEditClick}
                        onSetActive={handleSetActive}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="PROMPT" className="space-y-4 mt-4">
              {assets.PROMPT.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    暂无提示词模板，点击右上角按钮创建
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assets.PROMPT
                    .sort((a, b) => b.version - a.version)
                    .map(asset => (
                      <AssetVersionCard
                        key={asset.id}
                        asset={asset}
                        onView={handleView}
                        onEdit={handleEditClick}
                        onSetActive={handleSetActive}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="ATTACHMENT" className="space-y-4 mt-4">
              <Alert>
                <AlertDescription>
                  附件功能暂未开放。附件将从 ReferenceAsset 中关联，支持文件上传、OCR 识别和摘要生成。
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* 创建对话框 */}
      <CreateAssetDialog
        open={createDialogOpen}
        mode="create"
        assetType={activeTab}
        assetTypeLabel={ASSET_TYPE_LABELS[activeTab]}
        onClose={() => setCreateDialogOpen(false)}
        onSave={handleCreate}
      />

      {/* 编辑对话框 */}
      <CreateAssetDialog
        open={!!editingAsset}
        mode="edit"
        assetType={activeTab}
        assetTypeLabel={ASSET_TYPE_LABELS[activeTab]}
        initialData={editingAsset}
        onClose={() => setEditingAsset(null)}
        onSave={handleEdit}
      />

      {/* 查看对话框 */}
      <AssetViewDialog
        open={!!viewingAsset}
        asset={viewingAsset}
        onClose={() => setViewingAsset(null)}
      />
    </>
  )
}
