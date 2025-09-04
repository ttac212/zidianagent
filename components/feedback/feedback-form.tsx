"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Send, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FeedbackFormProps {
  onSuccess?: () => void
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "功能建议",
    priority: "medium",
    authorName: "",
    contactInfo: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const categories = ["功能建议", "问题报告", "使用体验", "性能优化", "界面设计"]
  const priorities = [
    { value: "low", label: "低优先级" },
    { value: "medium", label: "中优先级" },
    { value: "high", label: "高优先级" },
    { value: "urgent", label: "紧急" },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "提交失败",
        description: "标题和内容不能为空",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "提交成功",
          description: "感谢您的反馈，我们会尽快处理",
        })
        setFormData({
          title: "",
          content: "",
          category: "功能建议",
          priority: "medium",
          authorName: "",
          contactInfo: "",
        })
        onSuccess?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "提交失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          提交反馈
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">反馈标题</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="请简要描述您的反馈..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">反馈类型</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择反馈类型" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">优先级</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">详细描述</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange("content", e.target.value)}
              placeholder="请详细描述您遇到的问题或建议..."
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authorName">您的称呼（可选）</Label>
              <Input
                id="authorName"
                value={formData.authorName}
                onChange={(e) => handleInputChange("authorName", e.target.value)}
                placeholder="您的姓名或昵称"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactInfo">联系方式（可选）</Label>
              <Input
                id="contactInfo"
                value={formData.contactInfo}
                onChange={(e) => handleInputChange("contactInfo", e.target.value)}
                placeholder="邮箱或其他联系方式"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Send className="h-4 w-4 mr-2 animate-pulse" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  提交反馈
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
