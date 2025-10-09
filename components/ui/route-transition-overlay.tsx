"use client"

import { Loader2 } from "lucide-react"

export function RouteTransitionOverlay({ text = "正在进入工作区..." }: { text?: string }) {
  return (
    <div data-testid="route-transition-overlay" className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-card border border-border">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-foreground">{text}</span>
      </div>
    </div>
  )
}

