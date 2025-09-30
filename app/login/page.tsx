"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast/toast"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 预取工作区路由，加速首次进入
    router.prefetch('/workspace')
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      toast.error('请输入邮箱和密码')
      return
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('请输入有效的邮箱地址')
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        code: password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('登录失败', {
          description: '邮箱或密码错误，请重试'
        })
      } else if (result?.ok) {
        toast.success('登录成功')

        // 获取回调URL或默认跳转到工作区
        const callbackUrl = searchParams.get('callbackUrl') || '/workspace'
        router.push(callbackUrl)
      }
    } catch (error) {
      toast.error('登录失败', {
        description: '网络错误，请稍后重试'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* 左侧品牌区（桌面端显示） */}
      <section className="relative hidden lg:flex flex-col justify-between border-r border-border overflow-hidden">
        {/* 背景图 */}
        <div className="absolute inset-0">
          <Image
            src="/assets/20250826210819.jpg"
            alt="品牌展示图"
            fill
            sizes="(min-width: 1024px) 50vw, 0px"
            className="object-cover"
            priority
          />
          {/* 蒙层：保持与全局风格一致的浅色基底，确保文字可读性 */}
          <div className="absolute inset-0 bg-background/5" />
        </div>

        {/* 内容 */}
        <div className="relative z-10 p-8">
          <div className="text-sm font-semibold tracking-wide text-foreground/02">支点有星辰</div>
        </div>
        <div className="relative z-10 px-8 pb-8">
          <h2 className="text-2xl font-semibold mb-2">支点有星辰</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {`"使用一线的主流模型，助力文案创作"`}
            <span className="ml-1">— 天才游戏大王</span>
          </p>
        </div>
      </section>

      {/* 右侧表单区 */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold">欢迎登录</h1>
              <p className="text-sm text-muted-foreground">
                输入您的邮箱和密码以访问系统
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="输入您的密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>

            <div className="bg-muted/30 p-4 rounded-lg text-xs text-muted-foreground">
              <p className="mb-2 font-medium">登录说明：</p>
              <ul className="space-y-1">
                <li>• 使用管理员为您分配的邮箱账户</li>
                <li>• 首次登录请联系管理员获取密码</li>
                <li>• 如遇问题请联系系统管理员</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
