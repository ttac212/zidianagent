"use client"

import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { User, LogOut, Settings, BarChart3, Shield } from 'lucide-react'

export function UserMenu() {
  const { data, status } = useSession()
  const user = data?.user as any

  // 避免在加载过程中渲染，减少NextAuth获取错误
  if (status === 'loading') return null
  if (!user) return null

  // 安全地访问用户属性，提供默认值
  const currentUsage = user.currentMonthUsage || 0
  const tokenLimit = user.monthlyTokenLimit || 100000
  const usagePercentage = Math.round((currentUsage / tokenLimit) * 100)
  const isNearLimit = usagePercentage > 80

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {user.displayName || user.username || '用户'}
              </p>
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                {user.role === 'ADMIN' ? (
                  <>
                    <Shield className="mr-1 h-3 w-3" />
                    管理员
                  </>
                ) : (
                  '用户'
                )}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {user.email}
            </p>
            
            {/* 用量显示 */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>本月已用 Token</span>
                <span>{usagePercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all ${
                    isNearLimit ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{currentUsage.toLocaleString()}</span>
                <span>{tokenLimit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>使用统计</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />

        <DropdownMenuItem 
          onClick={() => {
            // 安全地调用退出登录
            if (data) {
              signOut({ callbackUrl: '/login' })
            }
          }} 
          className="text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}