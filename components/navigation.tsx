"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { NavItem } from "@/config/navigation"

export type NavigationProps = {
  items?: NavItem[]
  orientation?: "horizontal" | "vertical"
  activeMatch?: "equals" | "startsWith"
  className?: string
  onItemClick?: () => void
}

export function Navigation({
  items,
  orientation = "horizontal",
  activeMatch = "equals",
  className,
  onItemClick,
}: NavigationProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    // 特殊处理首页路径
    if (href === "/") {
      return pathname === "/"
    }
    
    if (activeMatch === "startsWith") return pathname.startsWith(href)
    return pathname === href
  }

  const isHorizontal = orientation === "horizontal"

  return (
    <nav
      aria-label="主导航"
      className={cn(
        "flex",
        isHorizontal ? "md:flex-row flex-col md:items-center md:space-x-1 space-y-1 md:space-y-0" : "flex-col space-y-1",
        className,
      )}
    >
      {(items ?? []).map((item) => {
        const active = isActive(item.href)
        return (
          <Button
            key={item.name}
            asChild
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn(
              "text-sm font-medium transition-colors md:justify-center justify-start w-full md:w-auto",
              active && "bg-primary text-primary-foreground",
            )}
          >
            <Link href={item.href} aria-current={active ? "page" : undefined} onClick={onItemClick}>
              <span>{item.name}</span>
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
