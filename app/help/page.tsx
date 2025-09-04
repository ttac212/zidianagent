"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/ui/page-transition"
import { KeyboardShortcuts } from "@/components/help/keyboard-shortcuts"
import { Search, BookOpen, MessageSquare, FileText, TrendingUp, Lightbulb, HelpCircle, Video, Zap } from "lucide-react"

const helpCategories = [
  {
    id: "getting-started",
    title: "快速开始",
    icon: <Zap className="h-5 w-5" />,
    description: "了解平台基础功能",
    articles: [
      { title: "平台介绍", content: "支点有星辰是一个专业的AI创作平台..." },
      { title: "注册和登录", content: "如何创建账户和登录平台..." },
      { title: "界面导览", content: "熟悉平台的主要界面和功能..." },
    ],
  },
  {
    id: "ai-chat",
    title: "AI对话",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "AI对话功能使用指南",
    articles: [
      { title: "开始对话", content: "如何与AI开始对话并获得最佳回复..." },
      { title: "模型选择", content: "不同AI模型的特点和使用场景..." },
      { title: "提示词技巧", content: "如何编写有效的提示词..." },
      { title: "对话管理", content: "如何管理和组织您的对话历史..." },
    ],
  },
  {
    id: "documents",
    title: "文档管理",
    icon: <FileText className="h-5 w-5" />,
    description: "文档创建和管理",
    articles: [
      { title: "创建文档", content: "如何创建和编辑Markdown文档..." },
      { title: "版本控制", content: "文档版本管理和历史记录..." },
      { title: "分类标签", content: "使用分类和标签组织文档..." },
      { title: "导出分享", content: "如何导出和分享您的文档..." },
    ],
  },
  {
    id: "trending",
    title: "热门数据",
    icon: <TrendingUp className="h-5 w-5" />,
    description: "热门数据分析功能",
    articles: [
      { title: "数据概览", content: "了解热门数据的来源和更新频率..." },
      { title: "筛选搜索", content: "如何筛选和搜索特定的数据..." },
      { title: "数据导出", content: "导出数据进行进一步分析..." },
    ],
  },
  {
    id: "inspiration",
    title: "灵感库",
    icon: <Lightbulb className="h-5 w-5" />,
    description: "创作灵感收集和管理",
    articles: [
      { title: "浏览灵感", content: "如何浏览和发现创作灵感..." },
      { title: "收藏管理", content: "收藏和管理您喜欢的灵感..." },
      { title: "分类筛选", content: "按分类和标签筛选灵感内容..." },
    ],
  },
]

const faqData = [
  {
    question: "如何开始使用AI对话功能？",
    answer: "点击导航栏中的'对话'按钮，然后在输入框中输入您的问题或需求，AI会为您提供专业的回答和建议。",
  },
  {
    question: "支持哪些AI模型？",
    answer: "平台支持GPT-4、GPT-3.5 Turbo、Claude等多种先进的AI模型，您可以根据需要选择合适的模型。",
  },
  {
    question: "如何保存和管理创作的内容？",
    answer: "您可以使用文档管理功能来保存、编辑和组织您的创作内容。支持Markdown格式和版本控制。",
  },
  {
    question: "热门数据多久更新一次？",
    answer: "热门数据每天更新，确保您获得最新的趋势信息和创作灵感。",
  },
  {
    question: "如何提高AI回复的质量？",
    answer: "提供清晰、具体的问题描述，使用相关的关键词，并在必要时提供上下文信息。",
  },
  {
    question: "是否支持移动端使用？",
    answer: "是的，平台完全支持移动端访问，您可以在手机和平板上正常使用所有功能。",
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("getting-started")

  const filteredCategories = helpCategories.filter(
    (category) =>
      category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.articles.some((article) => article.title.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const filteredFAQ = faqData.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto py-4 md:py-8 px-4">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* 页面标题 */}
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">帮助中心</h1>
              <p className="text-sm md:text-base text-muted-foreground">找到您需要的帮助信息，快速上手使用平台功能</p>
            </div>

            {/* 搜索栏 */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索帮助内容..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <KeyboardShortcuts />
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="guides" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="guides">使用指南</TabsTrigger>
                <TabsTrigger value="faq">常见问题</TabsTrigger>
                <TabsTrigger value="video">视频教程</TabsTrigger>
              </TabsList>

              <TabsContent value="guides" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCategories.map((category) => (
                    <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">{category.icon}</div>
                          <div>
                            <CardTitle className="text-lg">{category.title}</CardTitle>
                            <CardDescription>{category.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {category.articles.slice(0, 3).map((article, index) => (
                            <div
                              key={index}
                              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              • {article.title}
                            </div>
                          ))}
                          {category.articles.length > 3 && (
                            <div className="text-sm text-primary">查看更多 ({category.articles.length - 3})</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="faq" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      常见问题
                    </CardTitle>
                    <CardDescription>快速找到常见问题的答案</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {filteredFAQ.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                          <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="video" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: "平台快速入门", duration: "5:30", thumbnail: "入门教程" },
                    { title: "AI对话最佳实践", duration: "8:15", thumbnail: "对话技巧" },
                    { title: "文档管理详解", duration: "6:45", thumbnail: "文档管理" },
                    { title: "数据分析功能", duration: "7:20", thumbnail: "数据分析" },
                  ].map((video, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Video className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{video.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {video.duration}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{video.thumbnail}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* 联系支持 */}
            <Card>
              <CardHeader>
                <CardTitle>需要更多帮助？</CardTitle>
                <CardDescription>如果您没有找到需要的信息，请联系我们的支持团队</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    在线客服
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <BookOpen className="h-4 w-4" />
                    提交反馈
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </PageTransition>
  )
}
