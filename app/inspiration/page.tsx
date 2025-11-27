/**
 * 灵感库引导页
 */

import Link from "next/link"
import { Header } from "@/components/header"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Brain, Workflow } from "lucide-react"

export const metadata = {
  title: "灵感库 - 支点智创",
  description: "集中展示可复用的创作灵感与场景，帮助团队快速找到合适的工作台与工具。",
}

const inspirationSections = [
  {
    title: "运营灵感",
    desc: "直接进入工作台，在同一个界面沉淀素材、指挥模型和追踪效果。",
    icon: Sparkles,
    action: {
      href: "/workspace",
      label: "前往工作台",
    },
  },
  {
    title: "商家洞察",
    desc: "通过商家画像与内容库定位对标账号，并一键跳转数据分析页。",
    icon: Brain,
    action: {
      href: "/merchants",
      label: "查看商户列表",
    },
  },
  {
    title: "视频分发",
    desc: "使用抖音内容提取工具，快速拿到字幕与音轨，供模型继续润色。",
    icon: Workflow,
    action: {
      href: "/douyin-tool",
      label: "开启提取工具",
    },
  },
]

export default function InspirationPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="max-w-3xl">
          <p className="text-sm text-muted-foreground mb-2">灵感库</p>
          <h1 className="text-3xl font-semibold text-foreground mb-4">把真实场景分门别类</h1>
          <p className="text-muted-foreground">
            每个模块都落在现有路由上，不再把用户丢向 404。挑选场景后立即跳到对应功能，保持「Never break userspace」的底线。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {inspirationSections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.title} className="h-full flex flex-col">
                <CardHeader className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.desc}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild className="w-full">
                    <Link href={section.action.href}>{section.action.label}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
