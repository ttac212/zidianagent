/**
 * 使用量分析页面
 * 展示用户的Token使用情况和趋势
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import { UsageDashboard } from '@/components/analytics/usage-dashboard'

export const metadata = {
  title: '使用量分析 - 智点AI',
  description: '查看您的Token使用情况和趋势',
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/analytics')}`)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">使用量分析</h1>
        <p className="text-muted-foreground mt-2">
          查看您的Token使用情况、模型分布和历史趋势
        </p>
      </div>

      <UsageDashboard userId={session.user.id} days={30} />
    </div>
  )
}
