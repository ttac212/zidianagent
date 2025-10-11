"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Header } from "@/components/header"
import { AdminOverview } from "@/components/admin/admin-overview"
import { UserManagement } from "@/components/admin/user-management"
import { KeyManagement } from "@/components/admin/key-management"
import { Users, Key, Settings, AlertTriangle } from "lucide-react"

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-1">管理面板</h1>
            <p className="text-muted-foreground text-sm">用户管理和系统配置</p>
          </div>

          {/* 演示模式警告 */}
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>演示模式</AlertTitle>
            <AlertDescription>
              当前管理面板使用模拟数据，所有操作不会影响真实系统。真实 API 集成正在开发中。
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                系统概览
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                用户管理
              </TabsTrigger>
              <TabsTrigger value="keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                密钥管理
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AdminOverview />
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="keys">
              <KeyManagement />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
