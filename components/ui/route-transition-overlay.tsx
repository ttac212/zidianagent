"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Metrics } from "@/lib/metrics"

export function RouteTransitionOverlay({ text = "正在进入工作区..." }: { text?: string }) {
  useEffect(() => {
    const tracker = Metrics.startEndTracker('route_transition_overlay')
    tracker.start()
    return () => tracker.end()
  }, [])

  return (
    <div data-testid="route-transition-overlay" className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-card border border-border shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-foreground/80">{text}</span>
      </div>
    </div>
  )
}

