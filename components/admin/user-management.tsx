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
import { Search, Plus, Edit, Trash2, Users } from "lucide-react"
import { toast } from "@/lib/toast/toast"
import { useSession } from "next-auth/react"

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
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  // 使用统一的toast API

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        status: statusFilter,
        search: searchTerm
      })

      const response = await fetch(`/api/admin/users?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && Array.isArray(data.data?.users)) {
        setUsers(data.data.users)
      } else {
        throw new Error('响应格式异常')
      }
    } catch (error: any) {
      console.error('获取用户列表失败:', error)
      toast.error("获取用户列表失败", {
        description: error.message || "请稍后重试"
      })
    } finally {
      setLoading(false)
    }
  }

  // 编辑用户
  const handleEdit = (user: User) => {
    setEditingUser(user)
  }

  // 保存编辑
  const handleSaveEdit = async (updates: Partial<User>) => {
    if (!editingUser) return

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '更新失败')
      }

      toast.success("更新成功", {
        description: "用户信息已更新"
      })
      setEditingUser(null)
      fetchUsers()
    } catch (error: any) {
      toast.error("更新失败", {
        description: error.message || "请稍后重试"
      })
    }
  }

  // 删除用户
  const handleDelete = async (userId: string) => {
    // 防止删除自己
    if (session?.user && (session.user as any).id === userId) {
      toast.error("操作失败", {
        description: "不能删除自己的账号"
      })
      return
    }

    if (!confirm('确定要删除此用户吗？此操作不可恢复。')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '删除失败')
      }

      toast.success("删除成功", {
        description: "用户已删除"
      })
      fetchUsers()
    } catch (error: any) {
      toast.error("删除失败", {
        description: error.message || "请稍后重试"
      })
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTerm])

  const filteredUsers = users  // 已在 API 层过滤，前端不需要再过滤

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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(user)}
                          title="编辑用户"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          title="删除用户"
                          disabled={user.id === (token as any)?.sub}
                        >
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

      {/* 编辑用户对话框 */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
            </DialogHeader>
            <EditUserForm
              user={editingUser}
              onSave={handleSaveEdit}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function EditUserForm({ 
  user, 
  onSave 
}: { 
  user: User
  onSave: (updates: Partial<User>) => Promise<void>
}) {
  const [formData, setFormData] = useState({
    role: user.role,
    status: user.status,
    monthlyTokenLimit: user.monthlyTokenLimit || 100000,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSave(formData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>用户名（不可修改）</Label>
        <Input value={user.username} disabled />
      </div>

      <div className="space-y-2">
        <Label>邮箱（不可修改）</Label>
        <Input value={user.email} disabled />
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
        <Label htmlFor="status">状态</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="inactive">非活跃</SelectItem>
            <SelectItem value="suspended">已暂停</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyTokenLimit">月度Token限额</Label>
        <Input
          id="monthlyTokenLimit"
          type="number"
          value={formData.monthlyTokenLimit}
          onChange={(e) => setFormData((prev) => ({ ...prev, monthlyTokenLimit: Number(e.target.value) }))}
          min={0}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : "保存更改"}
        </Button>
      </div>
    </form>
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
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          role: formData.role,
          displayName: formData.username,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '创建失败')
      }

      toast.success("创建成功", {
        description: "用户已创建"
      })
      onSuccess()
    } catch (error: any) {
      toast.error("创建失败", {
        description: error.message || "请稍后重试"
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
