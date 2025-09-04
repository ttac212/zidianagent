"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeedbackForm } from "@/components/feedback/feedback-form"
import { FeedbackList } from "@/components/feedback/feedback-list"
import { List, Plus } from "lucide-react"

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState("list")

  const handleFeedbackSubmitted = () => {
    setActiveTab("list")
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">反馈中心</h1>
            <p className="text-muted-foreground">分享您的意见和建议，帮助我们改进</p>
          </div>

          {/* 反馈功能标签页 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                反馈列表
              </TabsTrigger>
              <TabsTrigger value="submit" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                提交反馈
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <FeedbackList />
            </TabsContent>

            <TabsContent value="submit">
              <FeedbackForm onSuccess={handleFeedbackSubmitted} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
