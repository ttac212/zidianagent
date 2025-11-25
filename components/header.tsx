"use client"

import Link from "next/link"
import { Navigation } from "./navigation"
import { ThemeToggle } from "./theme-toggle"
import { MobileDrawer } from "./ui/mobile-drawer"
import { DEFAULT_NAV_ITEMS, type NavItem } from "@/config/navigation"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export type HeaderProps = {
  showNavigation?: boolean
  brandSlot?: ReactNode
  actionsSlot?: ReactNode
  navItems?: NavItem[]
  variant?: "default" | "minimal" | "app"
  className?: string
}

export function Header({
  showNavigation = true,
  brandSlot,
  actionsSlot,
  navItems = DEFAULT_NAV_ITEMS,
  variant = "default",
  className,
}: HeaderProps) {
  // 统一使用原始 navItems，让 middleware 处理未认证用户的重定向
  // 这样可以避免 SSR/CSR hydration 不匹配问题
  const dynamicNavItems = navItems || []

  const base = "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200"
  const variants: Record<NonNullable<HeaderProps["variant"]>, string> = {
    default: base,
    minimal: "sticky top-0 z-50 w-full bg-background/80 backdrop-blur transition-all duration-200",
    app: base,
  }

  return (
    <header className={cn(variants[variant], className)}>
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <MobileDrawer navItems={dynamicNavItems} />
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {brandSlot ?? <span className="text-lg md:text-xl font-bold text-foreground">支点有星辰</span>}
          </Link>
          {showNavigation && (
            <div className="hidden md:block">
              <Navigation items={dynamicNavItems} activeMatch="startsWith" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actionsSlot ?? <ThemeToggle />}
        </div>
      </div>
    </header>
  )
}
