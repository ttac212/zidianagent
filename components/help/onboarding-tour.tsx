"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react"

interface TourStep {
  id: string
  title: string
  description: string
  target: string
  position: "top" | "bottom" | "left" | "right"
  action?: string
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "欢迎来到支点有星辰",
    description: "这是一个专业的AI创作平台，让我们一起探索它的强大功能！",
    target: "body",
    position: "bottom",
  },
  {
    id: "navigation",
    title: "导航菜单",
    description: "通过导航菜单可以快速访问不同的功能模块，包括对话、文档、热门数据等。",
    target: "nav",
    position: "bottom",
  },
  {
    id: "chat",
    title: "AI对话创作",
    description: "在这里与AI进行对话，创作高质量的短视频文案和其他内容。",
    target: "[href='/chat']",
    position: "bottom",
    action: "点击进入对话页面",
  },
  {
    id: "documents",
    title: "文档管理",
    description: "管理您的创作文档，支持Markdown编辑和版本控制。",
    target: "[href='/documents']",
    position: "bottom",
  },
  {
    id: "merchants",
    title: "商家中心",
    description: "查看商家数据，了解建材装修行业动态。",
    target: "[href='/merchants']",
    position: "bottom",
  },
  {
    id: "inspiration",
    title: "灵感库",
    description: "浏览和收藏创作灵感，激发您的创意潜能。",
    target: "[href='/inspiration']",
    position: "bottom",
  },
]

interface OnboardingTourProps {
  onComplete: () => void
  onSkip: () => void
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const step = tourSteps[currentStep]
    if (step) {
      const element = document.querySelector(step.target) as HTMLElement
      setTargetElement(element)

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
        element.style.position = "relative"
        element.style.zIndex = "1001"
      }
    }
  }, [currentStep])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsVisible(false)
    onComplete()
  }

  const handleSkip = () => {
    setIsVisible(false)
    onSkip()
  }

  if (!isVisible) return null

  const step = tourSteps[currentStep]

  return (
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black/50 z-1000" />

      {/* 引导卡片 */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-1001">
        <Card className="w-96 max-w-[90vw]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {currentStep + 1} / {tourSteps.length}
                </Badge>
                {step.action && <span className="text-sm text-muted-foreground">{step.action}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0} size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleNext} size="sm" className="gap-2">
                  {currentStep === tourSteps.length - 1 ? "完成" : "下一步"}
                  {currentStep < tourSteps.length - 1 && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
