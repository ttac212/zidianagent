/**
 * 编辑商家信息对话框组件
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { BusinessType, MerchantStatus } from '@prisma/client'

interface EditMerchantDialogProps {
  merchant: {
    id: string
    name: string
    description: string | null
    location: string | null
    address: string | null
    businessType: BusinessType
    status: MerchantStatus
    categoryId: string | null
  }
  categories?: Array<{ id: string; name: string; color?: string | null }>
  onSuccess?: () => void
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export function EditMerchantDialog({ merchant, categories = [], onSuccess }: EditMerchantDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: merchant.name,
    description: merchant.description || '',
    location: merchant.location || '',
    address: merchant.address || '',
    businessType: merchant.businessType,
    status: merchant.status,
    categoryId: merchant.categoryId || '',
  })
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // 当 merchant 变化时更新表单数据
  useEffect(() => {
    setFormData({
      name: merchant.name,
      description: merchant.description || '',
      location: merchant.location || '',
      address: merchant.address || '',
      businessType: merchant.businessType,
      status: merchant.status,
      categoryId: merchant.categoryId || '',
    })
  }, [merchant])

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: merchant.name,
      description: merchant.description || '',
      location: merchant.location || '',
      address: merchant.address || '',
      businessType: merchant.businessType,
      status: merchant.status,
      categoryId: merchant.categoryId || '',
    })
    setStatus('idle')
    setErrorMessage('')
  }

  // 处理提交
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setStatus('error')
      setErrorMessage('商家名称不能为空')
      return
    }

    try {
      setStatus('saving')
      setErrorMessage('')

      const response = await fetch(`/api/merchants/${merchant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          location: formData.location.trim() || null,
          address: formData.address.trim() || null,
          businessType: formData.businessType,
          status: formData.status,
          categoryId: formData.categoryId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '保存失败')
      }

      setStatus('success')

      // 1秒后关闭对话框并刷新
      setTimeout(() => {
        setOpen(false)
        resetForm()
        onSuccess?.()
      }, 1000)

    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '保存失败，请稍后重试')
    }
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && status !== 'saving') {
      resetForm()
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          编辑信息
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑商家信息</DialogTitle>
          <DialogDescription>
            修改商家的基本信息和分类
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 商家名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">商家名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={status === 'saving'}
              placeholder="请输入商家名称"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={status === 'saving'}
              placeholder="请输入商家描述"
              rows={4}
            />
          </div>

          {/* 地区和地址 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">所在地区</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={status === 'saving'}
                placeholder="例如：南宁"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">详细地址</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={status === 'saving'}
                placeholder="例如：广西 南宁 青秀区"
              />
            </div>
          </div>

          {/* 分类选择 */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="category">商家分类</Label>
              <Select
                value={formData.categoryId || undefined}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                disabled={status === 'saving'}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 业务类型 */}
          <div className="space-y-2">
            <Label htmlFor="businessType">业务类型</Label>
            <Select
              value={formData.businessType}
              onValueChange={(value) => setFormData({ ...formData, businessType: value as BusinessType })}
              disabled={status === 'saving'}
            >
              <SelectTrigger id="businessType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="B2C">B2C - 面向消费者</SelectItem>
                <SelectItem value="B2B">B2B - 面向企业</SelectItem>
                <SelectItem value="B2B2C">B2B2C - 混合模式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 状态 */}
          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as MerchantStatus })}
              disabled={status === 'saving'}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">活跃</SelectItem>
                <SelectItem value="INACTIVE">停用</SelectItem>
                <SelectItem value="SUSPENDED">暂停</SelectItem>
                <SelectItem value="DELETED">已删除</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 成功提示 */}
          {status === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                保存成功！即将关闭...
              </AlertDescription>
            </Alert>
          )}

          {/* 错误提示 */}
          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={status === 'saving'}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={status === 'saving' || status === 'success'}
          >
            {status === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
