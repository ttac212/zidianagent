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
import { ChevronDown, Check, Sparkles, Brain, Zap, Gem } from "lucide-react"
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

type ModelDisplay = {
  shortName: string
  fullName: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
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

  const getModelDisplay = (model: typeof ALLOWED_MODELS[0]): ModelDisplay => {
    const isThinking = model.id.includes(':thinking')

    switch (model.capabilities.family) {
      case 'gpt':
        return {
          shortName: 'GPT-5.1',
          fullName: 'GPT-5.1',
          description: 'OpenAI 最新推理模型，擅长复杂逻辑与代码生成',
          icon: Zap,
          iconClass: 'text-emerald-600'
        }
      case 'gemini':
        return {
          shortName: 'Gemini',
          fullName: 'Gemini 2.5 Pro',
          description: 'Google 多模态模型，支持图像与长文本输入',
          icon: Gem,
          iconClass: 'text-sky-600'
        }
      case 'claude':
      default:
        if (isThinking) {
          return {
            shortName: 'Sonnet 4.5',
            fullName: 'Claude Sonnet 4.5 · 深度思考',
            description: '启用深度推理，适合复杂问题与架构设计',
            icon: Brain,
            iconClass: 'text-purple-500'
          }
        }
        return {
          shortName: 'Sonnet 4.5',
          fullName: 'Claude Sonnet 4.5 · 标准',
          description: '快速响应，适合日常对话与分析任务',
          icon: Sparkles,
          iconClass: 'text-primary'
        }
    }
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
          {(() => {
            if (!current) {
              return <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            }
            const display = getModelDisplay(current)
            const Icon = display.icon
            return <Icon className={cn("w-3.5 h-3.5", display.iconClass)} aria-hidden="true" />
          })()}

          <span className="text-secondary-foreground">
            {current ? getModelDisplay(current).shortName : modelId}
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
            const display = getModelDisplay(m)
            const Icon = display.icon
            return (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onChange(m.id)}
                className="flex items-start gap-3 py-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 flex-shrink-0 mt-0.5">
                  <Icon className={cn("w-4 h-4", display.iconClass)} aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">
                      {display.fullName}
                    </span>
                    {modelId === m.id && (
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {display.description}
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
