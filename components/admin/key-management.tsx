"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Key, Plus, Copy, Trash2, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ApiKey {
  id: string
  key: string
  name: string
  permissions: string[]
  status: string
  createdAt: string
  expiresAt: string | null
  maxUsage: number | null
  currentUsage: number
  lastUsedAt: string | null
}

export function KeyManagement() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const fetchKeys = async () => {
    try {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockKeys: ApiKey[] = [
        {
          id: "1",
          key: "sk-1234567890abcdef1234567890abcdef",
          name: "生产环境密钥",
          permissions: ["chat", "documents"],
          status: "active",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: null,
          maxUsage: null,
          currentUsage: 1250,
          lastUsedAt: "2024-01-15T10:30:00Z",
        },
        {
          id: "2",
          key: "sk-abcdef1234567890abcdef1234567890",
          name: "测试环境密钥",
          permissions: ["chat"],
          status: "active",
          createdAt: "2024-01-10T00:00:00Z",
          expiresAt: "2024-02-10T00:00:00Z",
          maxUsage: 1000,
          currentUsage: 456,
          lastUsedAt: "2024-01-14T15:20:00Z",
        },
      ]

      setKeys(mockKeys)
    } catch (error) {
      toast({
        title: "获取密钥列表失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "无限制"
    return new Date(dateString).toLocaleString("zh-CN")
  }

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "active":
        return "default"
      case "inactive":
        return "secondary"
      case "expired":
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
      case "expired":
        return "已过期"
      default:
        return "未知"
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "复制成功",
      description: "API密钥已复制到剪贴板",
    })
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const maskKey = (key: string): string => {
    return `${key.substring(0, 8)}${"*".repeat(key.length - 12)}${key.substring(key.length - 4)}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              密钥管理
            </CardTitle>
            <CardDescription>生成和管理API访问密钥</CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                生成密钥
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>生成新的API密钥</DialogTitle>
              </DialogHeader>
              <CreateKeyForm
                onSuccess={() => {
                  setShowCreateDialog(false)
                  fetchKeys()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
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
                  <TableHead>密钥信息</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>使用情况</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{apiKey.name}</div>
                        <div className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                          <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                            {visibleKeys.has(apiKey.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(apiKey.key)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions.slice(0, 2).map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                        {apiKey.permissions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{apiKey.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(apiKey.status)}>{getStatusText(apiKey.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          {apiKey.currentUsage.toLocaleString()} / {apiKey.maxUsage?.toLocaleString() || "无限制"}
                        </div>
                        <div className="text-muted-foreground">
                          {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "从未使用"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{formatDate(apiKey.expiresAt)}</div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-sm text-muted-foreground mt-4">共 {keys.length} 个API密钥</div>
      </CardContent>
    </Card>
  )
}

function CreateKeyForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    permissions: [] as string[],
    expiresAt: "",
    maxUsage: "",
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

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

      toast({
        title: "创建成功",
        description: "API密钥已生成",
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "创建失败",
        description: "请稍后重试",
        variant: "destructive",
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
        <Label htmlFor="name">密钥名称</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="为密钥起一个名称..."
          required
        />
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

      <div className="space-y-2">
        <Label htmlFor="expiresAt">过期时间（可选）</Label>
        <Input
          id="expiresAt"
          type="datetime-local"
          value={formData.expiresAt}
          onChange={(e) => setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxUsage">最大使用次数（可选）</Label>
        <Input
          id="maxUsage"
          type="number"
          value={formData.maxUsage}
          onChange={(e) => setFormData((prev) => ({ ...prev, maxUsage: e.target.value }))}
          placeholder="留空表示无限制"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "生成中..." : "生成密钥"}
        </Button>
      </div>
    </form>
  )
}
