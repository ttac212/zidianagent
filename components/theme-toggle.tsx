"use client"
import * as React from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid SSR/CSR mismatch by rendering a stable placeholder until mounted
  React.useEffect(() => setMounted(true), [])

  const label = !mounted ? "主题" : resolvedTheme === "light" ? "深色" : "浅色"

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={!mounted}
      onClick={() => setTheme((resolvedTheme ?? "light") === "light" ? "dark" : "light")}
      className="h-9 px-3 rounded-md text-sm font-medium"
    >
      <span suppressHydrationWarning>{label}</span>
      <span className="sr-only">切换主题</span>
    </Button>
  )
}
