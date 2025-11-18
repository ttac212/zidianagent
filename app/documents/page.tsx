/**
 * 文档资料页
 */

import Link from "next/link"
import { Header } from "@/components/header"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "文档资料 - 支点智创",
  description: "集中列举产品手册、API 文档与入门指南，确保任何入口都能指向真实内容。",
}

const documents = [
  {
    title: "入门指南",
    desc: "第一天就能跑通工作台、商家洞察与模型调用。",
    action: { href: "/help", label: "查看指南" },
  },
  {
    title: "API 文档",
    desc: "调用方式、鉴权说明与速率限制都在这里。",
    action: { href: "/workspace", label: "前往控制台" },
  },
  {
    title: "常见问题",
    desc: "根据真实工单沉淀的 FAQ，避免重复踩坑。",
    action: { href: "/help#faq", label: "打开 FAQ" },
  },
]

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 space-y-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground">文档资料</p>
          <h1 className="text-3xl font-semibold text-foreground">所有可公开资料集中在此</h1>
          <p className="text-muted-foreground">
            任何一条文档链接都应该指向真实页面，而不是 404。这个页面就是统一入口。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <Card key={doc.title} className="flex flex-col">
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
                <CardDescription>{doc.desc}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <Link href={doc.action.href}>{doc.action.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
