/**
 * 商家数据展示页面
 * 使用 React Query 统一管理数据
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AddMerchantDialog } from '@/components/merchants/add-merchant-dialog'
import {
  Filter,
  Building2,
  MapPin,
  Calendar,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  RefreshCw
} from 'lucide-react'
import type {
  MerchantFilters
} from '@/types/merchant'
import {
  BUSINESS_TYPE_LABELS,
  MERCHANT_STATUS_LABELS
} from '@/types/merchant'
import {
  useMerchantsQuery,
  useMerchantCategoriesQuery,
  useMerchantStatsQuery,
  useInvalidateMerchants
} from '@/hooks/api/use-merchants-query'
import * as dt from '@/lib/utils/date-toolkit'

export default function MerchantsPage() {
  const { data: session } = useSession()
  const [filters, setFilters] = useState<MerchantFilters>({
    search: '',
    categoryId: '',
    location: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20
  })

  // 使用 React Query 获取数据
  const { data: merchantsData, isLoading: merchantsLoading, isFetching: merchantsFetching } = useMerchantsQuery(filters)
  const { data: categories = [], isFetching: categoriesFetching } = useMerchantCategoriesQuery()
  const { data: stats, isFetching: statsFetching } = useMerchantStatsQuery()
  const { invalidateAll } = useInvalidateMerchants()

  // 从 React Query 数据中提取
  const merchants = merchantsData?.merchants || []
  const total = merchantsData?.total || 0
  const loading = merchantsLoading

  // 修复 hydration 错误：使用 state + useEffect 延迟更新 fetching 状态
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    setRefreshing(merchantsFetching || categoriesFetching || statsFetching)
  }, [merchantsFetching, categoriesFetching, statsFetching])

  // 判断用户是否有权限添加商家（仅管理员可添加）
  const canAddMerchant = session?.user?.role === 'ADMIN'

  // 强制刷新所有数据
  const handleRefresh = async () => {
    await invalidateAll()
  }

  // 处理搜索
  const handleSearch = (value: string) => {
    setFilters({ ...filters, search: value, page: 1 })
  }

  // 处理筛选
  const handleFilter = (key: keyof MerchantFilters, value: string) => {
    setFilters({ ...filters, [key]: value || undefined, page: 1 })
  }

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`
    }
    return num.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">商家数据中心</h1>
          <p className="text-muted-foreground mt-1">
            支点有星辰合作数据
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1">
            共 {total} 家商家
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中...' : '刷新'}
          </Button>
          {canAddMerchant && (
            <AddMerchantDialog
              categories={categories}
              onSuccess={invalidateAll}
            />
          )}
        </div>
      </div>

      {/* 统计概览 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总商家数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMerchants}</div>
              <p className="text-xs text-muted-foreground">
                活跃: {stats.activeCount} | 停用: {stats.inactiveCount}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总内容数</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalContent)}</div>
              <p className="text-xs text-muted-foreground">视频、文章等内容</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总互动数</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalEngagement)}</div>
              <p className="text-xs text-muted-foreground">点赞、评论、收藏、分享</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">覆盖地区</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.locations.length}</div>
              <p className="text-xs text-muted-foreground">主要集中在广西地区</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            搜索筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索商家名称、描述或地区..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={filters.categoryId || "all"}
                onValueChange={(value) => handleFilter('categoryId', value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilter('sortBy', value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="name">商家名称</SelectItem>
                  <SelectItem value="totalContentCount">内容数量</SelectItem>
                  <SelectItem value="totalEngagement">互动总数</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 商家列表 */}
      <div className="space-y-4">
        {loading ? (
          // 加载骨架屏
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-10 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {merchants.map((merchant) => (
              <Card key={merchant.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {merchant.name}
                        {merchant.category && (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: merchant.category.color || '#6366f1',
                              color: merchant.category.color || '#6366f1'
                            }}
                          >
                            {merchant.category.name}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        {merchant.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {merchant.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {BUSINESS_TYPE_LABELS[merchant.businessType]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dt.parse(merchant.createdAt)?.toLocaleDateString() ?? '未知'}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge
                      variant={merchant.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {MERCHANT_STATUS_LABELS[merchant.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span>{merchant.totalContentCount} 内容</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-red-500" />
                        <span>{formatNumber(merchant.totalDiggCount)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3 text-blue-500" />
                        <span>{formatNumber(merchant.totalCommentCount)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 className="h-3 w-3 text-green-500" />
                        <span>{formatNumber(merchant.totalShareCount)}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/merchants/${merchant.id}`}>
                        查看详情
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {total > (filters.limit || 20) && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={filters.page === 1}
            onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
          >
            上一页
          </Button>
          <span className="flex items-center px-4">
            第 {filters.page} 页，共 {Math.ceil(total / (filters.limit || 20))} 页
          </span>
          <Button
            variant="outline"
            disabled={(filters.page || 1) * (filters.limit || 20) >= total}
            onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
          >
            下一页
          </Button>
        </div>
      )}
      </main>
    </div>
  )
}



