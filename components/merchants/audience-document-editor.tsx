"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  Trash2
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { SecureMarkdown } from "@/components/ui/secure-markdown"
import { useMerchantAudienceData, useUpdateAudienceManual } from "@/hooks/api/use-merchant-audience-analysis"
import { useMerchantProfile } from "@/hooks/api/use-merchant-profile"
import { cn } from "@/lib/utils"
import * as dt from "@/lib/utils/date-toolkit"

type PlanStatus = "todo" | "progress" | "done"

interface PlanItem {
  id: string
  title: string
  status: PlanStatus
  owner?: string
  notes?: string
  updatedAt: string
}

interface PlanInsightsPayload {
  plan?: PlanItem[]
  documentMeta?: {
    lastSavedAt?: string
    version?: number
  }
  [key: string]: any
}

const PLAN_STATUS_OPTIONS: { value: PlanStatus; label: string; hint: string }[] = [
  { value: "todo", label: "未开始", hint: "等待排期或资料未齐" },
  { value: "progress", label: "进行中", hint: "正在执行或评审" },
  { value: "done", label: "已完成", hint: "验证通过并归档" }
]

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return dt.uniqueId("plan")
}

const normalizeInsights = (raw: unknown): PlanInsightsPayload => {
  if (!raw) return {}
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw as PlanInsightsPayload
}

const sanitizePlan = (rawPlan: any): PlanItem[] => {
  if (!Array.isArray(rawPlan)) return []
  return rawPlan.map((item, index) => {
    const safeStatus: PlanStatus =
      item?.status === "progress" || item?.status === "done" ? item.status : "todo"

    return {
      id: typeof item?.id === "string" && item.id.length > 0 ? item.id : generateId(),
      title:
        typeof item?.title === "string" && item.title.trim().length > 0
          ? item.title.trim()
          : `未命名计划 ${index + 1}`,
      status: safeStatus,
      owner: typeof item?.owner === "string" ? item.owner : undefined,
      notes: typeof item?.notes === "string" ? item.notes : "",
      updatedAt:
        typeof item?.updatedAt === "string" && item.updatedAt.length > 0
          ? item.updatedAt
          : new Date().toISOString()
    }
  })
}

interface Props {
  merchantId: string
}

export function AudienceDocumentEditor({ merchantId }: Props) {
  const { data: analysisData, isLoading, error } = useMerchantAudienceData(merchantId)
  const { data: profileData } = useMerchantProfile(merchantId)
  const updateManual = useUpdateAudienceManual(merchantId)

  const [markdown, setMarkdown] = useState("")
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [newPlanTitle, setNewPlanTitle] = useState("")
  const [newPlanOwner, setNewPlanOwner] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const insightsRef = useRef<PlanInsightsPayload>({})
  const baselineRef = useRef<{ markdown: string; planJSON: string }>({
    markdown: "",
    planJSON: "[]"
  })

  useEffect(() => {
    if (!analysisData) return

    const initialMarkdown =
      analysisData.manualMarkdown ??
      (analysisData as any).markdown ??
      analysisData.rawMarkdown ??
      ""

    const normalizedInsights = normalizeInsights(analysisData.manualInsights)
    const initialPlan = sanitizePlan(normalizedInsights.plan)

    insightsRef.current = normalizedInsights
    baselineRef.current = {
      markdown: initialMarkdown,
      planJSON: JSON.stringify(initialPlan)
    }

    setMarkdown(initialMarkdown)
    setPlanItems(initialPlan)

    const savedFromMeta = normalizedInsights.documentMeta?.lastSavedAt
    const fallbackSaved = analysisData.manualMarkdown ? analysisData.analyzedAt : null

    setLastSavedAt(
      savedFromMeta ? dt.parse(savedFromMeta) : fallbackSaved ? dt.parse(fallbackSaved) : null
    )
  }, [analysisData?.id, analysisData?.manualMarkdown, analysisData?.manualInsights, analysisData?.rawMarkdown])

  const planHash = useMemo(() => JSON.stringify(planItems), [planItems])
  const isDirty =
    markdown !== baselineRef.current.markdown || planHash !== baselineRef.current.planJSON

  const completionRatio =
    planItems.length === 0
      ? 0
      : Math.round(
          (planItems.filter((item) => item.status === "done").length / planItems.length) * 100
        )

  const recentUpdates = useMemo(() => {
    return [...planItems]
      .sort((a, b) => {
        const aDate = dt.parse(a.updatedAt)?.getTime() ?? 0
        const bDate = dt.parse(b.updatedAt)?.getTime() ?? 0
        return bDate - aDate
      })
      .slice(0, 3)
  }, [planItems])

  const handleAddPlanItem = () => {
    if (!newPlanTitle.trim()) return
    const nextItem: PlanItem = {
      id: generateId(),
      title: newPlanTitle.trim(),
      owner: newPlanOwner.trim() || undefined,
      status: "todo",
      notes: "",
      updatedAt: new Date().toISOString()
    }
    setPlanItems((prev) => [...prev, nextItem])
    setNewPlanTitle("")
    setNewPlanOwner("")
  }

  const handlePlanChange = (id: string, updates: Partial<PlanItem>) => {
    setPlanItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    )
  }

  const handleRemovePlan = (id: string) => {
    setPlanItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSave = useCallback(async () => {
    if (!analysisData || updateManual.isPending || !isDirty) return

    const sanitizedPlan = planItems.map((item) => ({
      ...item,
      notes: item.notes || ""
    }))

    const nextInsights: PlanInsightsPayload = {
      ...insightsRef.current,
      plan: sanitizedPlan,
      documentMeta: {
        ...(insightsRef.current.documentMeta || {}),
        lastSavedAt: new Date().toISOString(),
        version: (insightsRef.current.documentMeta?.version ?? 0) + 1
      }
    }

    try {
      await updateManual.mutateAsync({
        manualMarkdown: markdown,
        manualInsights: nextInsights
      })

      insightsRef.current = nextInsights
      baselineRef.current = {
        markdown,
        planJSON: JSON.stringify(sanitizedPlan)
      }
      setLastSavedAt(nextInsights.documentMeta?.lastSavedAt ? new Date(nextInsights.documentMeta.lastSavedAt) : new Date())
    } catch (err) {
      console.error(err)
    }
  }, [analysisData, isDirty, markdown, planItems, updateManual])

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
          正在载入文档
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>无法载入文档</CardTitle>
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

  if (!analysisData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>尚未生成客群分析</CardTitle>
            <CardDescription>
              请先在商家页运行一次客群分析，系统会生成基础文档后再开启文档模式。
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

  const merchantName = profileData?.merchant?.name ?? "未命名商家"
  const stats = [
    {
      label: "分析视频数",
      value:
        typeof analysisData.videosAnalyzed === "number" ? `${analysisData.videosAnalyzed} 个` : "--"
    },
    {
      label: "评论样本数",
      value:
        typeof analysisData.commentsAnalyzed === "number" ? `${analysisData.commentsAnalyzed} 条` : "--"
    },
    {
      label: "模型",
      value: analysisData.modelUsed || "未知"
    },
    {
      label: "Token",
      value:
        typeof analysisData.tokenUsed === "number" && analysisData.tokenUsed > 0
          ? analysisData.tokenUsed.toLocaleString()
          : "0"
    }
  ]

  const canSave = isDirty && !updateManual.isPending

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
              <h1 className="text-2xl font-semibold text-foreground">客群对齐文档</h1>
              <p className="text-sm text-muted-foreground">
                {merchantName} · 结合 AI 分析 + 实施计划，持续对齐用户认知。
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
                {updateManual.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    保存文档
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="flex w-full flex-col gap-4 lg:w-80">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">行动计划</CardTitle>
              <CardDescription>列出你要推进的对齐动作并及时更新状态。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>整体进度</span>
                  <span>{completionRatio}%</span>
                </div>
                <Progress value={completionRatio} />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>计划总数：{planItems.length} 项</p>
                <p>
                  已完成：{planItems.filter((item) => item.status === "done").length} 项 / 进行中：
                  {planItems.filter((item) => item.status === "progress").length} 项
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  placeholder="计划标题，如「更新客群FAQ」"
                />
                <div className="flex gap-2">
                  <Input
                    value={newPlanOwner}
                    onChange={(e) => setNewPlanOwner(e.target.value)}
                    placeholder="负责人（可选）"
                  />
                  <Button onClick={handleAddPlanItem} className="shrink-0" disabled={!newPlanTitle.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-3">
                  {planItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      还没有计划。先写下你准备推进的第一步。
                    </p>
                  )}

                  {planItems.map((item) => {
                    const statusOption = PLAN_STATUS_OPTIONS.find((option) => option.value === item.status)
                    return (
                      <div key={item.id} className="rounded-lg border bg-card/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.title}
                            onChange={(e) => handlePlanChange(item.id, { title: e.target.value })}
                            className="text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePlan(item.id)}
                            title="删除计划"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Select
                            value={item.status}
                            onValueChange={(value: PlanStatus) => handlePlanChange(item.id, { status: value })}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent>
                              {PLAN_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={item.owner ?? ""}
                            onChange={(e) => handlePlanChange(item.id, { owner: e.target.value })}
                            placeholder="负责人"
                            className="h-8 text-xs"
                          />
                          {statusOption && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                item.status === "done" && "border-emerald-200 text-emerald-600 dark:border-emerald-900 dark:text-emerald-300",
                                item.status === "progress" && "border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-300"
                              )}
                            >
                              {statusOption.label}
                            </Badge>
                          )}
                        </div>
                        <Textarea
                          value={item.notes ?? ""}
                          onChange={(e) => handlePlanChange(item.id, { notes: e.target.value })}
                          rows={3}
                          placeholder="阶段备注、阻塞点、下一步..."
                        />
                        <p className="text-[11px] text-muted-foreground">
                          更新于 {dt.fromNow(item.updatedAt)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {recentUpdates.length > 0 && (
                <div className="space-y-1 pt-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">最近更新</p>
                  {recentUpdates.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <ClipboardList className="h-3 w-3" />
                      <span className="truncate">{item.title}</span>
                      <span className="ml-auto">{dt.fromNow(item.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据快照</CardTitle>
              <CardDescription>
                这里展示当前客群分析的关键信息，方便你在编辑文档时随时参考。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-base font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Markdown 文档
              </CardTitle>
              <CardDescription>
                左侧编辑、右侧实时预览。可加入二级标题/表格/任务清单，明确对齐要求。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>字数 {markdown.length}</span>
                <span>行数 {markdown.split(/\r?\n/).length}</span>
                {analysisData.analyzedAt && (
                  <span>分析时间：{dt.toLocal(dt.parse(analysisData.analyzedAt) ?? new Date(), "zh-CN")}</span>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  rows={28}
                  className="min-h-[600px] font-mono text-sm"
                  placeholder="使用 Markdown 撰写：\n## 当前客群画像\n- ...\n\n## 风险与机会\n- ...\n\n## 下一步计划\n- ..."
                />
                <div className="rounded-lg border bg-muted/30 p-4">
                  <ScrollArea className="h-[600px] pr-4">
                    {markdown ? (
                      <SecureMarkdown
                        content={markdown}
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
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default AudienceDocumentEditor
