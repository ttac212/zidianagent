/**
 * 反馈页
 */

import { Header } from "@/components/header"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata = {
  title: "产品反馈 - 支点智创",
  description: "提供统一的反馈渠道，确保每个入口都有着落。",
}

const channels = [
  {
    title: "在线工单",
    desc: "在工作台内提交工单，运营会在 1 个工作日内响应。",
    action: { href: "/workspace", label: "打开工作台" },
  },
  {
    title: "邮件支持",
    desc: "把日志和截图发送到 support@zdzd.dev，方便追踪。",
    action: { href: "mailto:support@zdzd.dev", label: "发送邮件" },
  },
  {
    title: "紧急问题",
    desc: "直接联系 On-call，确保核心链路不会被阻断。",
    action: { href: "/help", label: "查看联系方式" },
  },
]

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground">产品反馈</p>
          <h1 className="text-3xl font-semibold text-foreground">别再把用户丢进黑洞</h1>
          <p className="text-muted-foreground">
            所有反馈入口统一在此聚合，入口稳定、可追踪，彻底杜绝 404。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {channels.map((channel) => (
            <Card key={channel.title} className="flex flex-col">
              <CardHeader>
                <CardTitle>{channel.title}</CardTitle>
                <CardDescription>{channel.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full" variant={channel.action.href.startsWith("mailto") ? "outline" : "default"}>
                  <Link href={channel.action.href}>{channel.action.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
