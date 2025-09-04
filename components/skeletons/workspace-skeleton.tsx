"use client"

import React from "react"

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`relative overflow-hidden rounded bg-muted ${className} skeleton`} />
}

function MessageSkeleton({ align = "left" as "left" | "right" }) {
  const isRight = align === "right"
  return (
    <div className={`flex items-start gap-3 ${isRight ? "justify-end" : ""}`}>
      {!isRight && <SkeletonLine className="h-8 w-8 rounded-full" />}
      <div className={`flex-1 space-y-2 ${isRight ? "max-w-[60%]" : ""}`}>
        <SkeletonLine className={`h-4 ${isRight ? "w-2/3 ml-auto" : "w-1/3"}`} />
        <SkeletonLine className={`h-4 ${isRight ? "w-1/2 ml-auto" : "w-3/5"}`} />
        {!isRight && <SkeletonLine className="h-4 w-1/2" />}
      </div>
      {isRight && <SkeletonLine className="h-8 w-8 rounded-full" />}
    </div>
  )
}

export function WorkspaceSkeleton() {
  return (
    <div data-testid="workspace-skeleton" className="flex-1 flex overflow-hidden min-h-0 animate-pulse relative">
      {/* 左侧列表骨架 */}
      <div className="bg-card border-r border-border flex flex-col min-h-0 w-80 hidden md:flex">
        <div className="flex-shrink-0 p-4 border-b border-border">
          <SkeletonLine className="h-5 w-28" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="p-3 rounded border border-border bg-background/50">
              <SkeletonLine className="h-4 w-3/4 mb-2" />
              <SkeletonLine className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>

      {/* 主区域骨架 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 顶部工具条 */}
        <div className="flex items-center justify-between py-3 px-4 md:px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <SkeletonLine className="h-6 w-32" />
            <SkeletonLine className="h-6 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-8 w-8 rounded-md" />
            <SkeletonLine className="h-8 w-8 rounded-md" />
            <SkeletonLine className="h-8 w-20 rounded-md" />
          </div>
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5">
          <MessageSkeleton align="left" />
          <MessageSkeleton align="right" />
          <MessageSkeleton align="left" />
          <MessageSkeleton align="right" />
          <MessageSkeleton align="left" />
        </div>

        {/* 底部输入区 */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-10 flex-1" />
            <SkeletonLine className="h-10 w-16 rounded-md" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <SkeletonLine className="h-6 w-20" />
            <SkeletonLine className="h-6 w-24" />
            <SkeletonLine className="h-6 w-16" />
          </div>
        </div>
      </div>

      {/* 局部 shimmer 动画（styled-jsx） */}
      <style jsx>{`
        .skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.4) 50%,
            rgba(255,255,255,0) 100%
          );
          animation: shimmer 1.6s infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

