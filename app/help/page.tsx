/**
 * 帮助与支持页
 */

import { Header } from "@/components/header"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata = {
  title: "帮助中心 - 支点智创",
  description: "回答最常见的接入、权限与安全问题，让用户始终跳到正确的路径。",
}

const faqs = [
  {
    question: "如何进入系统？",
    answer: "点击右上角“控制台”或直接访问 /workspace。未登录用户会被带到 /login，并在登录后自动返回。",
  },
  {
    question: "数据分析在哪？",
    answer: "商家分析页位于 /merchants/[id]/analytics，主页的「数据分析」按钮现在稳定指向同一路径。",
  },
  {
    question: "没有权限怎么办？",
    answer: "管理员可在 /admin 管理账号，普通用户可以在 /settings 查看自己的使用情况并申请升级。",
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 space-y-10">
        <section className="max-w-3xl space-y-4">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/10">
            使用指南
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground">所有入口都在这</h1>
          <p className="text-muted-foreground">
            如果你只记得一个链接，就用 /help。这里把真实可访问的页面全部列明，杜绝再跳到不存在的路由。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/workspace">进入控制台</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/merchants">查看商家</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/settings">账号与用量</Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {faqs.map((faq) => (
            <Card key={faq.question} className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
                <CardDescription>{faq.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>还有其它问题？</CardTitle>
              <CardDescription>在工作台内通过工单或 Slack 联系运维，我们会确保链接和数据永远指向正确的位置。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button asChild variant="outline">
                <Link href="/workspace">打开工作台</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="mailto:support@zdzd.dev">发送邮件</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
