/**
 * 用户管理组件
 * 使用真实API和React Query
 */

'use client'

import { useState, useEffect } from 'react'
import {
  useAdminUsers,
  useUpdateUser,
  useDeleteUser,
  type AdminUser,
  type UpdateUserData,
} from '@/hooks/api/use-admin-users'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, Edit, Trash2, Users, CheckCircle, Ban } from 'lucide-react'
import { toast } from '@/lib/toast/toast'
import { useSession } from 'next-auth/react'

export function UserManagement() {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null)

  // Hooks
  const { data, isLoading } = useAdminUsers({ search, page, limit: 10 })
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  const handleUpdate = async (userId: string, updateData: UpdateUserData) => {
    try {
      await updateMutation.mutateAsync({ userId, data: updateData })
      toast.success('用户更新成功')
      setEditUser(null)
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    }
  }

  const handleDelete = async (userId: string) => {
    try {
      await deleteMutation.mutateAsync(userId)
      toast.success('用户已删除')
      setDeleteConfirm(null)
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          用户管理
        </CardTitle>
        <CardDescription>管理所有用户的权限、配额和状态</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 搜索 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户（邮箱、用户名、显示名称）"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
        </div>

        {/* 用户列表 */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : !data || data.users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无用户</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">用户</th>
                    <th className="text-left py-3 px-4">角色</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-right py-3 px-4">配额</th>
                    <th className="text-right py-3 px-4">已用</th>
                    <th className="text-right py-3 px-4">对话/消息</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{user.displayName || user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            user.role === 'ADMIN'
                              ? 'default'
                              : user.role === 'USER'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {user.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            活跃
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <Ban className="h-4 w-4" />
                            停用
                          </span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        {(user.monthlyTokenLimit / 1000).toFixed(0)}K
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        {(user.currentMonthUsage / 1000).toFixed(0)}K
                      </td>
                      <td className="text-right py-3 px-4 text-muted-foreground">
                        {user._count.conversations} / {user._count.messages}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditUser(user)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteConfirm(user)}
                            disabled={user.id === session?.user?.id}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                共 {data.pagination.total} 个用户
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm">
                  第 {page} / {data.pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* 编辑对话框 */}
      <EditDialog
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSave={handleUpdate}
        isLoading={updateMutation.isPending}
      />

      {/* 删除确认 */}
      <DeleteDialog
        user={deleteConfirm}
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        isLoading={deleteMutation.isPending}
      />
    </Card>
  )
}

// 编辑对话框
function EditDialog({
  user,
  open,
  onClose,
  onSave,
  isLoading,
}: {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onSave: (userId: string, data: UpdateUserData) => void
  isLoading: boolean
}) {
  const [role, setRole] = useState<string>('USER')
  const [status, setStatus] = useState<string>('ACTIVE')
  const [quota, setQuota] = useState<string>('100000')

  // 当 user 变化时，同步表单状态
  useEffect(() => {
    if (user) {
      setRole(user.role)
      setStatus(user.status)
      setQuota(String(user.monthlyTokenLimit))
    }
  }, [user])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">普通用户</SelectItem>
                <SelectItem value="ADMIN">管理员</SelectItem>
                <SelectItem value="GUEST">访客</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">活跃</SelectItem>
                <SelectItem value="SUSPENDED">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>月度Token配额</Label>
            <Input
              type="number"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              placeholder="100000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button
            onClick={() =>
              onSave(user.id, {
                role: role as any,
                status: status as any,
                monthlyTokenLimit: parseInt(quota),
              })
            }
            disabled={isLoading}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 删除确认对话框
function DeleteDialog({
  user,
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除用户？</DialogTitle>
          <DialogDescription>
            确定要删除用户 <strong>{user.email}</strong> 吗？
            <br />
            此操作将删除该用户的所有对话和消息，且无法恢复。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
