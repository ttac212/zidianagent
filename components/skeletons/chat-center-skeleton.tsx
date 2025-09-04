"use client"

import React from "react"

export function ChatCenterSkeleton() {
  return (
    <div data-testid="chat-center-skeleton" className="flex flex-col h-full animate-pulse select-none">
      {/* Top toolbar skeleton */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-6 w-20 rounded bg-muted/70" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-muted" />
          <div className="h-8 w-8 rounded-md bg-muted" />
          <div className="h-8 w-20 rounded-md bg-muted" />
        </div>
      </div>

      {/* Messages list skeleton */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* Assistant bubble */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
        </div>
        {/* User bubble */}
        <div className="flex gap-3 items-start justify-end">
          <div className="flex-1 space-y-2 max-w-[70%]">
            <div className="h-4 w-2/3 bg-muted rounded ml-auto" />
            <div className="h-4 w-1/2 bg-muted rounded ml-auto" />
          </div>
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
        {/* Assistant bubble */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 bg-muted rounded" />
            <div className="h-4 w-3/5 bg-muted rounded" />
            <div className="h-4 w-1/2 bg-muted rounded" />
            <div className="h-4 w-1/3 bg-muted rounded" />
          </div>
        </div>
        {/* User bubble */}
        <div className="flex gap-3 items-start justify-end">
          <div className="flex-1 space-y-2 max-w-[60%]">
            <div className="h-4 w-1/2 bg-muted rounded ml-auto" />
            <div className="h-4 w-1/3 bg-muted rounded ml-auto" />
          </div>
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
      </div>

      {/* Bottom input area skeleton */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 rounded-md bg-muted" />
          <div className="h-10 w-16 rounded-md bg-muted" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-6 w-20 rounded bg-muted/70" />
          <div className="h-6 w-24 rounded bg-muted/70" />
          <div className="h-6 w-16 rounded bg-muted/70" />
        </div>
      </div>
    </div>
  )
}

