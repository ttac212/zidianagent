"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  List,
  AlignLeft,
  Sparkles
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SecureMarkdown } from "@/components/ui/secure-markdown"
import { SegmentedMarkdownEditor } from "@/components/ui/segmented-markdown-editor"
import { useMerchantProfile, useUpdateProfile } from "@/hooks/api/use-merchant-profile"
import { parseStoredProfile } from "@/lib/ai/profile-parser"
import type { ProfileBrief } from "@/types/merchant"
import * as dt from "@/lib/utils/date-toolkit"
import { toast } from "sonner"

interface Props {
  merchantId: string
}

/**
 * 将ProfileBrief转换为Markdown文档
 */
function briefToMarkdown(brief: ProfileBrief | null): string {
  if (!brief) return ""

  const sections: string[] = []

  // 商家简介
  if (brief.intro) {
    sections.push(`## 商家简介\n\n${brief.intro}`)
  }

  // 核心卖点
  if (brief.sellingPoints && brief.sellingPoints.length > 0) {
    sections.push(
      `## 核心卖点\n\n${brief.sellingPoints.map((p) => `- ${p}`).join("\n")}`
    )
  }

  // 使用场景
  if (brief.usageScenarios && brief.usageScenarios.length > 0) {
    sections.push(
      `## 使用场景/痛点\n\n${brief.usageScenarios.map((s) => `- ${s}`).join("\n")}`
    )
  }

  // 目标用户画像
  if (brief.audienceProfile) {
    const profile = brief.audienceProfile
    const parts: string[] = []

    if (profile.age) parts.push(`**年龄**：${profile.age}`)
    if (profile.gender) parts.push(`**性别**：${profile.gender}`)

    if (profile.interests && profile.interests.length > 0) {
      parts.push(`**兴趣偏好**：\n${profile.interests.map((i) => `- ${i}`).join("\n")}`)
    }

    if (profile.behaviors) parts.push(`**行为/消费习惯**：${profile.behaviors}`)

    if (parts.length > 0) {
      sections.push(`## 目标用户画像\n\n${parts.join("\n\n")}`)
    }
  }

  // 品牌语调
  if (brief.brandTone) {
    sections.push(`## 品牌语调\n\n${brief.brandTone}`)
  }

  return sections.join("\n\n")
}

/**
 * 从Markdown文档解析回ProfileBrief
 */
function markdownToBrief(markdown: string): ProfileBrief {
  const brief: ProfileBrief = {
    intro: "",
    sellingPoints: [],
    usageScenarios: [],
    audienceProfile: {
      age: "",
      gender: "",
      interests: [],
      behaviors: ""
    },
    brandTone: ""
  }

  // 简单的段落解析（按 ## 标题分段）
  const sections = markdown.split(/^## /m).filter(Boolean)

  sections.forEach((section) => {
    const [title, ...contentLines] = section.split("\n")
    const content = contentLines.join("\n").trim()

    if (title.includes("商家简介")) {
      brief.intro = content
    } else if (title.includes("核心卖点")) {
      brief.sellingPoints = content
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.replace(/^-\s*/, "").trim())
        .filter(Boolean)
    } else if (title.includes("使用场景") || title.includes("痛点")) {
      brief.usageScenarios = content
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.replace(/^-\s*/, "").trim())
        .filter(Boolean)
    } else if (title.includes("目标用户画像")) {
      // 解析用户画像字段
      const ageMatch = content.match(/\*\*年龄\*\*[：:]\s*(.+?)(?:\n|$)/i)
      if (ageMatch) brief.audienceProfile.age = ageMatch[1].trim()

      const genderMatch = content.match(/\*\*性别\*\*[：:]\s*(.+?)(?:\n|$)/i)
      if (genderMatch) brief.audienceProfile.gender = genderMatch[1].trim()

      const interestsSection = content.match(/\*\*兴趣偏好\*\*[：:]?\s*\n([\s\S]*?)(?=\n\*\*|$)/i)
      if (interestsSection) {
        brief.audienceProfile.interests = interestsSection[1]
          .split("\n")
          .filter((line) => line.trim().startsWith("-"))
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean)
      }

      const behaviorsMatch = content.match(/\*\*行为\/消费习惯\*\*[：:]\s*(.+?)(?:\n|$)/i)
      if (behaviorsMatch) brief.audienceProfile.behaviors = behaviorsMatch[1].trim()
    } else if (title.includes("品牌语调")) {
      brief.brandTone = content
    }
  })

  return brief
}

export function ProfileDocumentEditor({ merchantId }: Props) {
  const { data, isLoading, error } = useMerchantProfile(merchantId)
  const updateMutation = useUpdateProfile(merchantId)

  const [briefMarkdown, setBriefMarkdown] = useState("")
  const [customBackground, setCustomBackground] = useState("")
  const [customOfflineInfo, setCustomOfflineInfo] = useState("")
  const [customProductDetails, setCustomProductDetails] = useState("")
  const [customDosAndDonts, setCustomDosAndDonts] = useState("")
  const [manualNotes, setManualNotes] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [editMode, setEditMode] = useState<'segmented' | 'plain'>('segmented')

  const baselineRef = useRef({
    briefMarkdown: "",
    customBackground: "",
    customOfflineInfo: "",
    customProductDetails: "",
    customDosAndDonts: "",
    manualNotes: ""
  })

  // 初始化数据
  useEffect(() => {
    if (!data?.profile) return

    const profile = data.profile
    const parsed = parseStoredProfile(profile)
    const initialBriefMarkdown = briefToMarkdown(parsed.brief)

    const initialData = {
      briefMarkdown: initialBriefMarkdown,
      customBackground: profile.customBackground || "",
      customOfflineInfo: profile.customOfflineInfo || "",
      customProductDetails: profile.customProductDetails || "",
      customDosAndDonts: profile.customDosAndDonts || "",
      manualNotes: profile.manualNotes || ""
    }

    baselineRef.current = initialData
    setBriefMarkdown(initialBriefMarkdown)
    setCustomBackground(initialData.customBackground)
    setCustomOfflineInfo(initialData.customOfflineInfo)
    setCustomProductDetails(initialData.customProductDetails)
    setCustomDosAndDonts(initialData.customDosAndDonts)
    setManualNotes(initialData.manualNotes)

    if (profile.updatedAt) {
      setLastSavedAt(dt.parse(profile.updatedAt) || null)
    }
  }, [data])

  const isDirty = useMemo(() => {
    return (
      briefMarkdown !== baselineRef.current.briefMarkdown ||
      customBackground !== baselineRef.current.customBackground ||
      customOfflineInfo !== baselineRef.current.customOfflineInfo ||
      customProductDetails !== baselineRef.current.customProductDetails ||
      customDosAndDonts !== baselineRef.current.customDosAndDonts ||
      manualNotes !== baselineRef.current.manualNotes
    )
  }, [briefMarkdown, customBackground, customOfflineInfo, customProductDetails, customDosAndDonts, manualNotes])

  const handleSave = useCallback(async () => {
    if (!data?.profile || updateMutation.isPending || !isDirty) return

    try {
      const manualBrief = markdownToBrief(briefMarkdown)

      await updateMutation.mutateAsync({
        manualBrief,
        customBackground,
        customOfflineInfo,
        customProductDetails,
        customDosAndDonts,
        manualNotes
      })

      baselineRef.current = {
        briefMarkdown,
        customBackground,
        customOfflineInfo,
        customProductDetails,
        customDosAndDonts,
        manualNotes
      }

      setLastSavedAt(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败，请稍后重试"
      toast.error(message)
      console.error(err)
    }
  }, [data, isDirty, briefMarkdown, customBackground, customOfflineInfo, customProductDetails, customDosAndDonts, manualNotes, updateMutation])

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleSave])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在载入档案
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>无法载入档案</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/merchants/${merchantId}`}>返回商家详情</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data?.profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>尚未生成档案</CardTitle>
            <CardDescription>
              请先在商家页生成创作档案，然后再使用文档模式编辑。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button asChild>
              <Link href={`/merchants/${merchantId}`}>返回商家详情</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const merchantName = data.merchant?.name ?? "未命名商家"
  const profile = data.profile
  const canSave = isDirty && !updateMutation.isPending

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b bg-card/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/merchants/${merchantId}`} className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Link>
              </Button>
              <Badge variant="secondary">{merchantId}</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                商家创作档案
              </h1>
              <p className="text-sm text-muted-foreground">
                {merchantName} · 文档模式，分段编辑 + 实时保存
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground lg:items-end">
            <div className="flex items-center gap-2 text-xs">
              <span>状态：</span>
              <Badge variant={isDirty ? "destructive" : "outline"}>
                {isDirty ? "有未保存改动" : "已保存"}
              </Badge>
            </div>
            <div>
              最后保存：
              {lastSavedAt ? dt.toLocal(lastSavedAt, "zh-CN", { hour: "2-digit", minute: "2-digit" }) : "尚未保存"}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="gap-2"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    保存档案
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        {/* 档案元数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">档案信息</CardTitle>
            <CardDescription>
              当前档案的生成信息和统计数据
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">生成时间</p>
              <p className="text-base font-semibold text-foreground">
                {profile.aiGeneratedAt
                  ? dt.toLocal(dt.parse(profile.aiGeneratedAt) ?? new Date(), "zh-CN")
                  : "未生成"}
              </p>
            </div>
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">使用模型</p>
              <p className="text-base font-semibold text-foreground">
                {profile.aiModelUsed || "未知"}
              </p>
            </div>
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Token消耗</p>
              <p className="text-base font-semibold text-foreground">
                {profile.aiTokenUsed?.toLocaleString() || "0"}
              </p>
            </div>
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">档案来源</p>
              <p className="text-base font-semibold text-foreground">
                {parseStoredProfile(profile).source === 'manual' ? '人工编辑' : 'AI生成'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 创作简报 (Brief) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  创作简报 (Brief)
                </CardTitle>
                <CardDescription>
                  {editMode === 'segmented'
                    ? '段落模式：点击展开/折叠段落，快速定位编辑。'
                    : '纯文本模式：左侧编辑 Markdown，右侧实时预览。'
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 rounded-md border p-1">
                <Button
                  variant={editMode === 'segmented' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditMode('segmented')}
                  className="h-8 gap-1 text-xs"
                >
                  <List className="h-4 w-4" />
                  段落模式
                </Button>
                <Button
                  variant={editMode === 'plain' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditMode('plain')}
                  className="h-8 gap-1 text-xs"
                >
                  <AlignLeft className="h-4 w-4" />
                  纯文本
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>字数 {briefMarkdown.length}</span>
              <span>行数 {briefMarkdown.split(/\r?\n/).length}</span>
            </div>
            {editMode === 'segmented' ? (
              <SegmentedMarkdownEditor
                value={briefMarkdown}
                onChange={setBriefMarkdown}
                placeholder="使用 Markdown 撰写创作简报：\n## 商家简介\n...\n\n## 核心卖点\n- ...\n\n## 使用场景/痛点\n- ..."
                defaultExpandAll={false}
                className="min-h-[500px]"
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Textarea
                  value={briefMarkdown}
                  onChange={(e) => setBriefMarkdown(e.target.value)}
                  rows={24}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder="使用 Markdown 撰写创作简报：\n## 商家简介\n...\n\n## 核心卖点\n- ...\n\n## 使用场景/痛点\n- ..."
                />
                <div className="rounded-lg border bg-muted/30 p-4">
                  <ScrollArea className="h-[500px] pr-4">
                    {briefMarkdown ? (
                      <SecureMarkdown
                        content={briefMarkdown}
                        variant="prose"
                        className="prose-headings:text-foreground prose-p:text-sm prose-p:text-muted-foreground"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        预览区会实时显示 Markdown 渲染效果
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 人工补充信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">人工补充信息</CardTitle>
            <CardDescription>
              真实沟通中的高频问题、注意事项、需要编导提前确认的点
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={6}
              className="min-h-[140px]"
              placeholder="真实沟通中的高频问题、注意事项、需要编导提前确认的点..."
            />
          </CardContent>
        </Card>

        {/* 商家背景故事 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商家背景故事</CardTitle>
            <CardDescription>
              老板是谁、创业故事、品牌历史等
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customBackground}
              onChange={(e) => setCustomBackground(e.target.value)}
              rows={8}
              className="min-h-[180px]"
              placeholder="老板是谁、创业故事、品牌历史等..."
            />
          </CardContent>
        </Card>

        {/* 线下信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">线下信息</CardTitle>
            <CardDescription>
              实体店位置、店面特点、地理优势等
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customOfflineInfo}
              onChange={(e) => setCustomOfflineInfo(e.target.value)}
              rows={8}
              className="min-h-[180px]"
              placeholder="实体店位置、店面特点、地理优势等..."
            />
          </CardContent>
        </Card>

        {/* 产品详细信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">产品详细信息</CardTitle>
            <CardDescription>
              产品规格、使用方法、独特工艺等 AI 不知道的细节
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customProductDetails}
              onChange={(e) => setCustomProductDetails(e.target.value)}
              rows={8}
              className="min-h-[180px]"
              placeholder="产品规格、使用方法、独特工艺等AI不知道的细节..."
            />
          </CardContent>
        </Card>

        {/* 禁忌与必强调点 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">禁忌与必强调点</CardTitle>
            <CardDescription>
              禁忌词汇、不能提及的竞品、必须强调的卖点等
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customDosAndDonts}
              onChange={(e) => setCustomDosAndDonts(e.target.value)}
              rows={6}
              className="min-h-[140px]"
              placeholder="禁忌词汇、不能提及的竞品、必须强调的卖点等..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
