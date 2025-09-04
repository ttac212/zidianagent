'use client'

import { useConversationsQuery, useCreateConversationMutation } from '@/hooks/api/use-conversations-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle, Loader2, Plus, RefreshCw } from 'lucide-react'

/**
 * React Query 功能测试页面
 * 用于验证阶段1.1的实施效果
 */
export default function TestQueryPage() {
  // 使用新的React Query hooks
  const { 
    data: conversations, 
    isLoading, 
    isError, 
    error, 
    refetch,
    dataUpdatedAt 
  } = useConversationsQuery()

  const createMutation = useCreateConversationMutation()

  const handleCreateTest = () => {
    createMutation.mutate({
      modelId: 'gpt-3.5-turbo',
      title: `测试对话 ${Date.now()}`
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">React Query 功能测试</h1>
          <p className="text-muted-foreground">
            验证阶段1.1的React Query集成是否正常工作
          </p>
        </div>

        {/* 状态指示器 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">加载状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">加载完成</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">错误状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {isError ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">有错误</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">正常</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">缓存状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  {dataUpdatedAt ? `更新于 ${new Date(dataUpdatedAt).toLocaleTimeString()}` : '无数据'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            重新获取
          </Button>
          
          <Button 
            onClick={handleCreateTest} 
            variant="outline" 
            size="sm"
            disabled={createMutation.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {createMutation.isPending ? '创建中...' : '创建测试对话'}
          </Button>
        </div>

        {/* 错误显示 */}
        {isError && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 text-sm">错误信息</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600">
                {error?.message || '未知错误'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 创建对话状态 */}
        {createMutation.isError && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 text-sm">创建对话错误</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600">
                {createMutation.error?.message || '创建对话失败'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 数据展示 */}
        <Card>
          <CardHeader>
            <CardTitle>对话列表数据</CardTitle>
            <CardDescription>
              验证数据获取和缓存是否正常工作
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div key={conv.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{conv.title}</h4>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {conv.model}
                        </Badge>
                        <span>{conv.messages.length} 消息</span>
                        <span>{conv.totalTokens} tokens</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无对话数据</p>
                <p className="text-sm mt-2">这可能是因为用户未登录或数据库中没有数据</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* React Query DevTools 提示 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">React Query DevTools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>开发环境下，您应该能在页面右下角看到 React Query DevTools 按钮。</p>
              <p>点击它可以查看查询状态、缓存数据和性能指标。</p>
              {process.env.NODE_ENV === 'development' && (
                <Badge variant="outline" className="text-green-600">
                  开发环境 - DevTools 已启用
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 测试清单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">阶段1.1测试清单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>React Query 依赖安装成功</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>QueryProvider 组件创建并集成</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>对话查询hooks创建完成</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>开发服务器正常启动</span>
              </div>
              <div className="flex items-center space-x-2">
                {!isError ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <span>API查询功能测试 {!isError ? '通过' : '需要验证认证状态'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}