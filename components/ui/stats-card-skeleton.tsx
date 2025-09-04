import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 数据统计卡片的加载骨架组件
 */
export const StatsCardSkeleton = () => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* 图标骨架 */}
          <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            {/* 标题骨架 */}
            <Skeleton className="h-4 w-20" />
            {/* 数据骨架 */}
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 批量数据卡片加载骨架
 */
export const StatsCardsGridSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
    </div>
  )
}

/**
 * 使用情况详细卡片的加载骨架
 */
export const UsageDetailCardSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近30天使用情况</CardTitle>
        <CardDescription>Token使用量和请求数统计</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 生成5个加载项 */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}