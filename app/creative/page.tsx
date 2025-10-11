'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { AuthGuard } from '@/components/creative/auth-guard'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  Image as ImageIcon, 
  Layers, 
  ArrowRight,
  FileText,
  Zap,
  Clock,
  TrendingUp
} from 'lucide-react'
import { BatchStatusBadge } from '@/components/creative/batch-status-badge'

interface RecentBatch {
  id: string
  status: string
  modelId: string
  createdAt: string
  copyCount: number
  merchantId: string
}

export default function CreativePage() {
  const router = useRouter()
  const { status } = useSession()  // 只使用 status
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([])
  const [loading, setLoading] = useState(true)

  // 加载最近批次
  useEffect(() => {
    if (status === 'authenticated') {
      fetchRecentBatches()
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [status])

  const fetchRecentBatches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/creative/batches?limit=5&sortBy=createdAt&sortOrder=desc')
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setRecentBatches(data.data)
        }
      }
    } catch (error) {
      console.error('加载最近批次失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      icon: Package,
      title: '批次管理',
      description: '创建和管理创意批次，批量生成内容',
      href: '/merchants',
      badge: '需选择商家',
      color: 'text-blue-500'
    },
    {
      icon: ImageIcon,
      title: '素材库',
      description: '管理创意素材和资源文件',
      href: '/merchants',
      badge: '需选择商家',
      color: 'text-purple-500'
    }
  ]

  const quickActions = [
    {
      icon: Zap,
      label: '查看商家列表',
      description: '选择商家开始创意管理',
      action: () => router.push('/merchants')
    },
    {
      icon: FileText,
      label: '创作工作台',
      description: '开始 AI 创作',
      action: () => router.push('/workspace')
    }
  ]

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
      
      <div className="container mx-auto p-6 space-y-8">
        {/* 页面头部 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">创意中心</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            管理创意批次、素材资源，批量生成营销内容
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <Card 
              key={feature.title}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(feature.href)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg bg-primary/10`}>
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {feature.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between group">
                  访问功能
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 快捷操作 */}
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
            <CardDescription>快速访问常用功能</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto p-4 justify-start"
                  onClick={action.action}
                >
                  <action.icon className="h-5 w-5 mr-3 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {action.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 说明信息 */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg">💡</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">使用提示</h3>
                <p className="text-sm text-muted-foreground">
                  创意中心的批次管理和素材库功能需要关联到具体商家。请先访问
                  <Link href="/merchants" className="text-primary hover:underline mx-1">
                    商家中心
                  </Link>
                  选择或创建商家，然后在商家详情页中访问对应的创意管理功能。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最近批次 */}
        {status === 'authenticated' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    最近批次
                  </CardTitle>
                  <CardDescription>您最近创建的文案批次</CardDescription>
                </div>
                {recentBatches.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={fetchRecentBatches}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    刷新
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : recentBatches.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    暂无批次记录。前往
                    <Link href="/merchants" className="text-primary hover:underline mx-1">
                      商家中心
                    </Link>
                    选择商家后开始创建批次。
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {recentBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/creative/batches/${batch.id}`)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <BatchStatusBadge 
                          status={batch.status as any} 
                          copyCount={batch.copyCount}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground truncate">
                              {batch.id}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {batch.modelId}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {new Date(batch.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        查看详情
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </AuthGuard>
  )
}
