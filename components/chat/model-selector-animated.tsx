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
import { ChevronDown, Check } from "lucide-react"
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
      case 'gpt': {
        const gptName = model.name || 'GPT 系列'
        return {
          shortName: gptName,
          fullName: gptName
        }
      }
      case 'gemini': {
        const geminiName = model.name || 'Gemini'
        const geminiShort = geminiName.split(' ')[0] || 'Gemini'
        return {
          shortName: geminiShort,
          fullName: geminiName
        }
      }
      case 'claude':
      default: {
        const claudeName = model.name || 'Claude Sonnet 4.5'
        // 从名称中提取 shortName：去掉 "Claude " 前缀
        const shortName = claudeName.replace(/^Claude\s*/i, '') || claudeName
        if (isThinking) {
          return {
            shortName,
            fullName: `${claudeName} · 深度思考`
          }
        }
        return {
          shortName,
          fullName: `${claudeName} · 标准`
        }
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
            return (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => onChange(m.id)}
                className="flex items-center justify-between gap-2 py-2 cursor-pointer"
              >
                <span className="font-medium text-sm">
                  {display.fullName}
                </span>
                {modelId === m.id && (
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
