/**
 * 创意中心权限守卫组件
 * 统一处理所有创意相关页面的权限检查
 */

'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = '/login' }: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(redirectTo)
    }
  }, [status, router, redirectTo])

  // 加载中
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  // 未认证
  if (status === 'unauthenticated' || !session) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>需要登录</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>请先登录后再访问此页面</span>
              <Button onClick={() => router.push(redirectTo)}>
                前往登录
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // 已认证，渲染子组件
  return <>{children}</>
}
