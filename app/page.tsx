"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sparkles, Shield, Layers } from "lucide-react"
import { useSession } from "next-auth/react"
import { HomePageSkeleton } from "@/components/skeletons/home-page-skeleton"
import { ConnectionStatus } from "@/components/ui/connection-status"

export default function HomePage() {
  const { status } = useSession()
  const workspaceTarget = status === "authenticated" ? "/workspace" : "/login"

  // 在session加载期间显示骨架屏
  if (status === "loading") {
    return <HomePageSkeleton />
  }



  const features = [
    { 
      icon: Sparkles, 
      title: "智能高效", 
      desc: "AI驱动的创作流程，即时响应与流式输出，将想法快速转化为成品" 
    },
    { 
      icon: Shield, 
      title: "安全可靠", 
      desc: "企业级安全保障，稳定的服务架构，确保数据安全与业务连续性" 
    },
    { 
      icon: Layers, 
      title: "智能场景", 
      desc: "覆盖营销、文案、总结等多种创作场景，智能适配不同需求与平台" 
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* 连接状态指示器 - 仅在认证用户的情况下显示 */}
      {status === "authenticated" && (
        <ConnectionStatus
          position="fixed"
          size="sm"
          className="top-20 right-4 z-[45]"
          animated={true}
          autoHideWhenHealthy={true}
          showDetails={false}
        />
      )}

      {/* Hero：微网格/噪点纹理 + 排版优化 */}
      <section className="relative overflow-hidden py-32 md:py-40 px-4">
        {/* 背景层：微网格 + 噪点（极低不透明度） */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          {/* 网格（约 3% 透明度） */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* 噪点（约 4% 透明度） */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><filter id='n' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>\")",
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl md:max-w-4xl mx-auto md:mx-0 text-center md:text-left">
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary border-primary/20 text-sm px-4 py-2">
              AI驱动的创作平台
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight text-foreground">
              支点有星辰
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl md:max-w-3xl">
              提供沉浸式的内容创作体验
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <Button asChild size="lg" className="px-12 py-3 text-lg">
                <Link href={workspaceTarget}>开始创作</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-12 py-3 text-lg bg-transparent">
                <Link href="/inspiration">浏览灵感库</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="px-10 py-3 text-lg hidden sm:inline-flex">
                <Link href="/help">了解平台</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* 用例/模板 Tabs（P2） */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-6">常用场景</h2>
          <Tabs defaultValue="marketing" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="marketing" className="text-xs">营销文案</TabsTrigger>
              <TabsTrigger value="script" className="text-xs">短视频脚本</TabsTrigger>
              <TabsTrigger value="summary" className="text-xs">长文总结</TabsTrigger>
            </TabsList>
            <TabsContent value="marketing" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">产品推广帖</h3>
                  <p className="text-sm text-muted-foreground">快速生成多平台适配的推广文案。</p>
                </div>
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">电商详情优化</h3>
                  <p className="text-sm text-muted-foreground">一键优化标题/卖点/描述。</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="script" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">短视频开场</h3>
                  <p className="text-sm text-muted-foreground">为不同平台自动适配钩子与节奏。</p>
                </div>
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">分镜脚本</h3>
                  <p className="text-sm text-muted-foreground">按场景生成分镜要点与旁白。</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">长文摘要</h3>
                  <p className="text-sm text-muted-foreground">提炼要点，保留关键事实与结论。</p>
                </div>
                <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
                  <h3 className="font-semibold mb-2">会议纪要</h3>
                  <p className="text-sm text-muted-foreground">自动输出行动项与负责人。</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* 微示例区块（P3） */}
      <section className="px-4 py-4">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2">
          {/* 左：几步开始 */}
          <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80">
            <p className="text-xs text-muted-foreground mb-3">几步开始</p>
            <ol className="space-y-3 text-sm">
              <li>1. 选择创作场景（营销/脚本/总结）</li>
              <li>2. 填写核心要点（品牌/产品/受众）</li>
              <li>3. 点击“开始创作”，实时生成并微调</li>
            </ol>
          </div>
          {/* 右：配置示例 */}
          <div className="rounded-xl border border-border p-6 bg-card transition-colors duration-200 hover:bg-card/80 font-mono text-xs leading-relaxed">
            <p className="text-[11px] text-muted-foreground mb-3">输入示例</p>
            <pre className="whitespace-pre-wrap">{`{
  "角色": "模型会自动匹配最合适的角色",
  "需求": "需要什么文案",
  "相关信息": ["品牌", "产品", "受众" ],
  "优势特点": {
    "是否差异化": ["品牌调性", "核心卖点"],
    "平台": "抖音"
  }
}`}</pre>
          </div>
        </div>
      </section>

      {/* KPM 指标条（P3） */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-lg font-medium text-center mb-8 text-foreground/80">平台数据</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-semibold">99.95%</div>
              <div className="text-xs text-muted-foreground mt-1">服务可用性</div>
            </div>
            <div>
              <div className="text-3xl font-semibold">~1.2s</div>
              <div className="text-xs text-muted-foreground mt-1">平均响应延迟</div>
            </div>
            <div>
              <div className="text-3xl font-semibold">10K+</div>
              <div className="text-xs text-muted-foreground mt-1">日活生成量</div>
            </div>
            <div>
              <div className="text-3xl font-semibold">50%</div>
              <div className="text-xs text-muted-foreground mt-1">成本节省</div>
            </div>
          </div>
        </div>
      </section>





      {/* 优势区：3-6 项卡片式要点 */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20 px-3 py-1">
              核心优势
            </Badge>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">为什么选择我们</h2>
            <p className="text-sm md:text-base text-muted-foreground mt-2">面向创作全流程的专业能力与体验</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="h-full bg-card transition-all duration-200 hover:bg-card/80 hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <f.icon className="size-5 text-primary" />
                    <CardTitle className="text-base md:text-lg">{f.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {f.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 收束式 CTA：中性背景，强调主 CTA */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">开始您的创作之旅</h2>
          <p className="text-base md:text-lg text-muted-foreground mt-4">体验前沿的大模型，立即开启高效创作</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button asChild size="lg" className="px-12 py-3 text-lg">
              <Link href={workspaceTarget}>立即开始</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-12 py-3 text-lg bg-transparent">
              <Link href="/inspiration">浏览灵感库</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer 保持原有结构与风格 */}
      <footer className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <h3 className="font-bold text-2xl text-foreground mb-4">支点有星辰</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                专业的AI创作平台，让创作变得更加智能和高效
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6 text-lg">产品</h4>
              <div className="space-y-3">
                <Link href={workspaceTarget} className="block text-muted-foreground hover:text-primary transition-colors">
                  创作工作台
                </Link>
                <Link href="/inspiration" className="block text-muted-foreground hover:text-primary transition-colors">
                  灵感库
                </Link>
                <Link href="/documents" className="block text-muted-foreground hover:text-primary transition-colors">
                  文档管理
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6 text-lg">支持</h4>
              <div className="space-y-3">
                <Link href="/help" className="block text-muted-foreground hover:text-primary transition-colors">
                  帮助中心
                </Link>
                <Link href="/feedback" className="block text-muted-foreground hover:text-primary transition-colors">
                  意见反馈
                </Link>
                <Link href="/settings" className="block text-muted-foreground hover:text-primary transition-colors">
                  设置
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 支点有星辰. 保留所有权利.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
