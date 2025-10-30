"use client"

import * as React from "react"
import type { ButtonHTMLAttributes } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Check, Sparkles, Brain } from "lucide-react"
import { ALLOWED_MODELS } from "@/lib/ai/models"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

interface ModelSelectorAnimatedProps {
  modelId: string
  onChange: (modelId: string) => void
  className?: string
  disabled?: boolean
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>
}

export function ModelSelectorAnimated({
  modelId,
  onChange,
  className,
  disabled = false,
  buttonProps
}: ModelSelectorAnimatedProps) {
  const current = ALLOWED_MODELS.find((m) => m.id === modelId)
  const isEmpty = ALLOWED_MODELS.length === 0
  const [open, setOpen] = React.useState(false)

  // 简化显示名称（只保留核心信息）
  const getDisplayName = (_model: typeof ALLOWED_MODELS[0]) => {
    return 'Sonnet 4.5'  // 统一显示为 Sonnet 4.5
  }

  const button = (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      data-state={disabled ? undefined : (open ? "open" : "closed")}
      className={cn(
        "flex items-center gap-1.5 h-8 px-3 text-xs rounded-md font-medium",
        "border border-border",
        "transition-all duration-200",
        "hover:bg-secondary/80 hover:border-ring/60",
        "active:bg-secondary/60",
        "data-[state=open]:bg-secondary/60 data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
        className
      )}
      {...buttonProps}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={modelId}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5"
        >
          {/* 模型图标 */}
          {current?.capabilities.supportsReasoning ? (
            <Brain className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          )}

          <span className="text-secondary-foreground">
            {current ? getDisplayName(current) : modelId}
          </span>

          <ChevronDown
            className={cn(
              "w-3 h-3 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>
    </Button>
  )

  if (disabled) {
    return button
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {button}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(
          "min-w-[16rem]",
          "border border-border",
          "bg-popover text-popover-foreground"
        )}
        align="start"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          选择模型模式
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isEmpty ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            无可用模型，请联系管理员配置 MODEL_ALLOWLIST
          </DropdownMenuItem>
        ) : (
          ALLOWED_MODELS.map((m) => {
            const isThinking = m.id.includes(':thinking')
            return (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onChange(m.id)}
                className="flex items-start gap-3 py-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 flex-shrink-0 mt-0.5">
                  {isThinking ? (
                    <Brain className="w-4 h-4 text-purple-500" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">
                      {isThinking ? '深度思考模式' : '标准模式'}
                    </span>
                    {modelId === m.id && (
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {isThinking
                      ? '启用深度推理，适合复杂问题和逻辑分析'
                      : '快速响应，适合日常对话和简单任务'
                    }
                  </p>
                </div>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
