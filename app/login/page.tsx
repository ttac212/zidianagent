"use client"

import Image from "next/image"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { InviteCodeAuth } from "@/components/auth/invite-code-auth"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // 预取工作区路由，加速首次进入
    router.prefetch('/workspace')
  }, [router])

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
            “使用一线的主流模型，助力文案创作”
            <span className="ml-1">— 天才游戏大王</span>
          </p>
        </div>
      </section>

      {/* 右侧表单区 */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-lg">
          <InviteCodeAuth />
        </div>
      </section>
    </div>
  )
}
