"use client"

import React from "react"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AIPromptPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">AI Prompt · 设计规范验证</h1>
        <ThemeToggle />
      </header>
      <AI_Prompt />
    </div>
  )
}

