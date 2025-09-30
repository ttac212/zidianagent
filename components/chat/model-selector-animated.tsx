"use client"

import * as React from "react"
import type { ButtonHTMLAttributes } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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

export function ModelSelectorAnimated({
  modelId,
  onChange,
  className,
  disabled = false,
  buttonProps
}: ModelSelectorAnimatedProps) {
  const current = ALLOWED_MODELS.find((m) => m.id === modelId)
  const isEmpty = ALLOWED_MODELS.length === 0

  const button = (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 h-8 pl-1 pr-2 text-xs rounded-md",
        "bg-secondary text-secondary-foreground transition-colors",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary/80",
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
          className="flex items-center gap-1"
        >
          <span>{current?.name || modelId}</span>
          <ChevronDown className="w-3 h-3 opacity-50" aria-hidden="true" />
        </motion.div>
      </AnimatePresence>
    </Button>
  )

  if (disabled) {
    return button
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {button}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(
          "min-w-[12rem]",
          "border border-border",
          "bg-popover text-popover-foreground"
        )}
        align="start"
      >
        {isEmpty ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            ���޿���ģ�ͣ�����ϵ����Ա���� MODEL_ALLOWLIST
          </DropdownMenuItem>
        ) : (
          ALLOWED_MODELS.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => onChange(m.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <span>{m.name}</span>
              </span>
              {modelId === m.id && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
