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
import { Input } from '@/components/ui/input'
import { useUpdateProfile, useProfileVersions } from '@/hooks/api/use-merchant-profile'
import type { MerchantProfile, ProfileBrief } from '@/types/merchant'
import { parseStoredProfile } from '@/lib/ai/profile-parser'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const splitToList = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)

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
  const parsedBrief = profile ? parseStoredProfile(profile).brief : null
  const [formData, setFormData] = useState({
    customBackground: profile?.customBackground || '',
    customOfflineInfo: profile?.customOfflineInfo || '',
    customProductDetails: profile?.customProductDetails || '',
    customDosAndDonts: profile?.customDosAndDonts || '',
    manualNotes: profile?.manualNotes || ''
  })
  const [manualBriefIntro, setManualBriefIntro] = useState(parsedBrief?.intro || '')
  const [manualSellingPoints, setManualSellingPoints] = useState(
    (parsedBrief?.sellingPoints || []).join('\n')
  )
  const [manualUsageScenarios, setManualUsageScenarios] = useState(
    (parsedBrief?.usageScenarios || []).join('\n')
  )
  const [manualAudienceAge, setManualAudienceAge] = useState(parsedBrief?.audienceProfile?.age || '')
  const [manualAudienceGender, setManualAudienceGender] = useState(parsedBrief?.audienceProfile?.gender || '')
  const [manualAudienceInterests, setManualAudienceInterests] = useState(
    (parsedBrief?.audienceProfile?.interests || []).join(', ')
  )
  const [manualAudienceBehaviors, setManualAudienceBehaviors] = useState(
    parsedBrief?.audienceProfile?.behaviors || ''
  )
  const [manualBrandTone, setManualBrandTone] = useState(parsedBrief?.brandTone || '')

  const updateMutation = useUpdateProfile(merchantId)
  const versionsQuery = useProfileVersions(open ? merchantId : undefined)

  // 当profile变化时更新表单数据
  useEffect(() => {
    if (profile) {
      const parsed = parseStoredProfile(profile).brief
      setFormData({
        customBackground: profile.customBackground || '',
        customOfflineInfo: profile.customOfflineInfo || '',
        customProductDetails: profile.customProductDetails || '',
        customDosAndDonts: profile.customDosAndDonts || '',
        manualNotes: profile.manualNotes || ''
      })
      setManualBriefIntro(parsed?.intro || '')
      setManualSellingPoints((parsed?.sellingPoints || []).join('\n'))
      setManualUsageScenarios((parsed?.usageScenarios || []).join('\n'))
      setManualAudienceAge(parsed?.audienceProfile?.age || '')
      setManualAudienceGender(parsed?.audienceProfile?.gender || '')
      setManualAudienceInterests((parsed?.audienceProfile?.interests || []).join(', '))
      setManualAudienceBehaviors(parsed?.audienceProfile?.behaviors || '')
      setManualBrandTone(parsed?.brandTone || '')
    }
  }, [profile])

  const handleSubmit = async () => {
    try {
      const manualBrief: ProfileBrief = {
        intro: manualBriefIntro.trim(),
        sellingPoints: splitToList(manualSellingPoints),
        usageScenarios: splitToList(manualUsageScenarios),
        audienceProfile: {
          age: manualAudienceAge.trim(),
          gender: manualAudienceGender.trim(),
          interests: splitToList(manualAudienceInterests),
          behaviors: manualAudienceBehaviors.trim()
        },
        brandTone: manualBrandTone.trim()
      }

      const hasManual =
        manualBrief.intro ||
        manualBrief.sellingPoints.length > 0 ||
        manualBrief.usageScenarios.length > 0 ||
        manualBrief.audienceProfile.age ||
        manualBrief.audienceProfile.gender ||
        manualBrief.audienceProfile.interests.length > 0 ||
        manualBrief.audienceProfile.behaviors ||
        manualBrief.brandTone

      await updateMutation.mutateAsync({
        ...formData,
        manualBrief: hasManual ? manualBrief : undefined
      })
      toast.success('档案已更新')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[1100px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑创作档案</DialogTitle>
          <DialogDescription>
            仅编辑人工补充部分,AI分析部分请点击&ldquo;刷新档案&rdquo;重新生成。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 人工补充信息 */}
          <div className="space-y-2">
            <Label htmlFor="manualNotes">人工补充信息（真实沟通高频问题/提醒）</Label>
            <Textarea
              id="manualNotes"
              value={formData.manualNotes}
              onChange={(e) =>
                setFormData({ ...formData, manualNotes: e.target.value })
              }
              placeholder="真实沟通中的高频问题、注意事项、需要编导提前确认的点..."
              rows={6}
              className="min-h-[140px]"
            />
          </div>

          {/* 人工校对 Brief */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label>人工校对 Brief（留空则继续使用AI版本）</Label>
              <p className="text-xs text-muted-foreground">
                建议用换行或逗号分隔列表项，保存后优先展示人工版本并写入版本历史。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualBriefIntro">商家简介</Label>
              <Textarea
                id="manualBriefIntro"
                value={manualBriefIntro}
                onChange={(e) => setManualBriefIntro(e.target.value)}
                placeholder="3句话说清楚是谁/做什么/有什么特点"
                rows={4}
                className="min-h-[110px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualSellingPoints">核心卖点（每行或逗号分隔）</Label>
              <Textarea
                id="manualSellingPoints"
                value={manualSellingPoints}
                onChange={(e) => setManualSellingPoints(e.target.value)}
                rows={6}
                className="min-h-[140px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualUsageScenarios">使用场景/痛点（每行或逗号分隔）</Label>
              <Textarea
                id="manualUsageScenarios"
                value={manualUsageScenarios}
                onChange={(e) => setManualUsageScenarios(e.target.value)}
                rows={6}
                className="min-h-[140px]"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="manualAudienceAge">目标年龄</Label>
                <Input
                  id="manualAudienceAge"
                  value={manualAudienceAge}
                  onChange={(e) => setManualAudienceAge(e.target.value)}
                  placeholder="如：20-35"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualAudienceGender">性别/比例</Label>
                <Input
                  id="manualAudienceGender"
                  value={manualAudienceGender}
                  onChange={(e) => setManualAudienceGender(e.target.value)}
                  placeholder="如：女性为主/男女均衡"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualAudienceInterests">兴趣偏好（逗号或换行分隔）</Label>
              <Textarea
                id="manualAudienceInterests"
                value={manualAudienceInterests}
                onChange={(e) => setManualAudienceInterests(e.target.value)}
                rows={4}
                className="min-h-[110px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualAudienceBehaviors">行为/消费习惯</Label>
              <Textarea
                id="manualAudienceBehaviors"
                value={manualAudienceBehaviors}
                onChange={(e) => setManualAudienceBehaviors(e.target.value)}
                rows={4}
                className="min-h-[110px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualBrandTone">品牌语调</Label>
              <Input
                id="manualBrandTone"
                value={manualBrandTone}
                onChange={(e) => setManualBrandTone(e.target.value)}
                placeholder="如：专业/温情/搞笑 + 补充说明"
              />
            </div>
          </div>

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
              rows={8}
              className="min-h-[180px]"
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
              rows={8}
              className="min-h-[180px]"
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
              rows={8}
              className="min-h-[180px]"
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
              rows={6}
              className="min-h-[140px]"
            />
          </div>

          {versionsQuery.data && versionsQuery.data.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">版本历史</Badge>
                <p className="text-sm text-muted-foreground">最近10条保存记录</p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
                {versionsQuery.data.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border rounded p-2">
                    <span>{typeof v.createdAt === 'string' ? v.createdAt : v.createdAt.toISOString?.()}</span>
                    <Badge variant="secondary">{v.source}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
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
