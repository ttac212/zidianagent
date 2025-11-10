/**
 * 商家创作档案 - 编辑对话框组件
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateProfile } from '@/hooks/api/use-merchant-profile'
import type { MerchantProfile } from '@/types/merchant'
import { toast } from 'sonner'

interface ProfileEditDialogProps {
  merchantId: string
  profile: MerchantProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditDialog({
  merchantId,
  profile,
  open,
  onOpenChange
}: ProfileEditDialogProps) {
  const [formData, setFormData] = useState({
    customBackground: profile?.customBackground || '',
    customOfflineInfo: profile?.customOfflineInfo || '',
    customProductDetails: profile?.customProductDetails || '',
    customDosAndDonts: profile?.customDosAndDonts || ''
  })

  const updateMutation = useUpdateProfile(merchantId)

  // 当profile变化时更新表单数据
  useEffect(() => {
    if (profile) {
      setFormData({
        customBackground: profile.customBackground || '',
        customOfflineInfo: profile.customOfflineInfo || '',
        customProductDetails: profile.customProductDetails || '',
        customDosAndDonts: profile.customDosAndDonts || ''
      })
    }
  }, [profile])

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync(formData)
      toast.success('档案已更新')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑创作档案</DialogTitle>
          <DialogDescription>
            仅编辑人工补充部分,AI分析部分请点击&ldquo;刷新档案&rdquo;重新生成。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 商家背景故事 */}
          <div className="space-y-2">
            <Label htmlFor="customBackground">商家背景故事</Label>
            <Textarea
              id="customBackground"
              value={formData.customBackground}
              onChange={(e) =>
                setFormData({ ...formData, customBackground: e.target.value })
              }
              placeholder="老板是谁、创业故事、品牌历史等..."
              rows={4}
            />
          </div>

          {/* 线下信息 */}
          <div className="space-y-2">
            <Label htmlFor="customOfflineInfo">线下信息</Label>
            <Textarea
              id="customOfflineInfo"
              value={formData.customOfflineInfo}
              onChange={(e) =>
                setFormData({ ...formData, customOfflineInfo: e.target.value })
              }
              placeholder="实体店位置、店面特点、地理优势等..."
              rows={4}
            />
          </div>

          {/* 产品详细信息 */}
          <div className="space-y-2">
            <Label htmlFor="customProductDetails">产品详细信息</Label>
            <Textarea
              id="customProductDetails"
              value={formData.customProductDetails}
              onChange={(e) =>
                setFormData({ ...formData, customProductDetails: e.target.value })
              }
              placeholder="产品规格、使用方法、独特工艺等AI不知道的细节..."
              rows={4}
            />
          </div>

          {/* 禁忌与必强调点 */}
          <div className="space-y-2">
            <Label htmlFor="customDosAndDonts">禁忌与必强调点</Label>
            <Textarea
              id="customDosAndDonts"
              value={formData.customDosAndDonts}
              onChange={(e) =>
                setFormData({ ...formData, customDosAndDonts: e.target.value })
              }
              placeholder="禁忌词汇、不能提及的竞品、必须强调的卖点等..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
