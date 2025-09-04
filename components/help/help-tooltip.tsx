"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HelpCircle, X } from "lucide-react"

interface HelpTooltipProps {
  content: string | ReactNode
  title?: string
  trigger?: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function HelpTooltip({ content, title, trigger, side = "top", className }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
      <HelpCircle className="h-4 w-4" />
    </Button>
  )

  return (
    <div className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger || defaultTrigger}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <Card className="absolute z-50 w-64 shadow-lg border">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {title && <h4 className="font-medium text-sm mb-1">{title}</h4>}
                  <div className="text-sm text-muted-foreground">{content}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setIsOpen(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
