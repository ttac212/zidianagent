"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Plus, Edit, Trash2, Key, Users } from "lucide-react"
import { toast } from "@/lib/toast/toast"

interface User {
  id: string
  username: string
  email: string
  role: string
  status: string
  permissions: string[]
  createdAt: string
  lastLoginAt: string | null
  totalSessions: number
  totalTokensUsed: number
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // 使用统一的toast API

  const fetchUsers = async () => {
    try {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockUsers: User[] = [
        {
          id: "1",
          username: "admin",
          email: "admin@example.com",
          role: "admin",
          status: "active",
          permissions: ["chat", "documents", "trending", "admin"],
          createdAt: "2024-01-01T00:00:00Z",
          lastLoginAt: "2024-01-15T10:30:00Z",
          totalSessions: 156,
          totalTokensUsed: 45000,
        },
        {
          id: "2",
          username: "user1",
          email: "user1@example.com",
          role: "user",
          status: "active",
          permissions: ["chat", "documents"],
          createdAt: "2024-01-05T00:00:00Z",
          lastLoginAt: "2024-01-14T15:20:00Z",
          totalSessions: 89,
          totalTokensUsed: 12000,
        },
      ]

      setUsers(mockUsers)
    } catch (_error) {
      toast.error("获取用户列表失败", {
        description: "请稍后重试"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "从未登录"
    return new Date(dateString).toLocaleString("zh-CN")
  }

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "active":
        return "default"
      case "inactive":
        return "secondary"
      case "suspended":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case "active":
        return "活跃"
      case "inactive":
        return "非活跃"
      case "suspended":
        return "已暂停"
      default:
        return "未知"
    }
  }

  const getRoleText = (role: string): string => {
    switch (role) {
      case "admin":
        return "管理员"
      case "premium":
        return "高级用户"
      case "user":
        return "普通用户"
      default:
        return "未知"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              用户管理
            </CardTitle>
            <CardDescription>管理系统用户和权限设置</CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                添加用户
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新用户</DialogTitle>
              </DialogHeader>
              <CreateUserForm
                onSuccess={() => {
                  setShowCreateDialog(false)
                  fetchUsers()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 搜索和筛选 */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">活跃</SelectItem>
              <SelectItem value="inactive">非活跃</SelectItem>
              <SelectItem value="suspended">已暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 用户表格 */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户信息</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>使用统计</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRoleText(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(user.status)}>{getStatusText(user.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>会话: {user.totalSessions}</div>
                        <div className="text-muted-foreground">Token: {user.totalTokensUsed.toLocaleString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{formatDate(user.lastLoginAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Key className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm text-muted-foreground">显示 {filteredUsers.length} 个用户</div>
      </CardContent>
    </Card>
  )
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "user",
    permissions: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  // 使用统一的toast API

  const allPermissions = [
    { id: "chat", label: "AI对话" },
    { id: "documents", label: "文档管理" },
    { id: "trending", label: "热门数据" },
    { id: "export", label: "数据导出" },
    { id: "admin", label: "管理权限" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast.success("创建成功", {
        description: "用户已创建"
      })
      onSuccess()
    } catch (_error) {
      toast.error("创建失败", {
        description: "请稍后重试"
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked ? [...prev.permissions, permissionId] : prev.permissions.filter((p) => p !== permissionId),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">角色</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">普通用户</SelectItem>
            <SelectItem value="premium">高级用户</SelectItem>
            <SelectItem value="admin">管理员</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>权限</Label>
        <div className="space-y-2">
          {allPermissions.map((permission) => (
            <div key={permission.id} className="flex items-center space-x-2">
              <Checkbox
                id={permission.id}
                checked={formData.permissions.includes(permission.id)}
                onCheckedChange={(checked) => handlePermissionChange(permission.id, checked as boolean)}
              />
              <Label htmlFor={permission.id}>{permission.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "创建中..." : "创建用户"}
        </Button>
      </div>
    </form>
  )
}
