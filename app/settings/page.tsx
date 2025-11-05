/**
 * 设置页面
 * 用量分析 + 账户管理
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"
import { useSession, signOut } from "next-auth/react"
import { User, LogOut } from "lucide-react"
import { UsageDashboard } from "@/components/analytics/usage-dashboard"

export default function SettingsPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">设置</h1>
            <p className="text-muted-foreground">查看使用量统计和管理账户</p>
          </div>

          <div className="space-y-6">
            {session?.user?.id ? (
              <>
                {/* 用量分析 */}
                <UsageDashboard userId={session.user.id} days={30} />

                {/* 账户管理 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      账户管理
                    </CardTitle>
                    <CardDescription>
                      当前登录: {session.user.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        signOut({ callbackUrl: "/login" })
                      }}
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">请先登录查看使用量数据</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
