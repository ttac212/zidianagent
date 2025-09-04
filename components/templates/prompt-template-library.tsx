"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wand2, Search, Star, Copy, Plus } from "lucide-react"

interface PromptTemplate {
  id: string
  title: string
  description: string
  content: string
  category: string
  tags: string[]
  isPopular?: boolean
}

const promptTemplates: PromptTemplate[] = [
  {
    id: "1",
    title: "美食短视频文案",
    description: "适用于美食类短视频的文案创作",
    content:
      "请为我创作一个关于{食物名称}的短视频文案，要求：\n1. 突出食物的色香味\n2. 包含制作过程的亮点\n3. 语言生动有趣，适合短视频传播\n4. 字数控制在100-150字",
    category: "美食",
    tags: ["短视频", "美食", "文案"],
    isPopular: true,
  },
  {
    id: "2",
    title: "旅游攻略文案",
    description: "旅游景点介绍和攻略文案",
    content:
      "请为{目的地}创作一份旅游攻略文案，包括：\n1. 景点特色介绍\n2. 最佳游览时间\n3. 交通方式\n4. 美食推荐\n5. 注意事项\n语言要轻松愉快，适合社交媒体分享",
    category: "旅游",
    tags: ["旅游", "攻略", "介绍"],
    isPopular: true,
  },
  {
    id: "3",
    title: "产品介绍文案",
    description: "商品或服务的营销文案",
    content:
      "请为{产品名称}创作产品介绍文案：\n1. 突出产品核心卖点\n2. 解决用户痛点\n3. 包含使用场景\n4. 呼吁行动\n5. 语言简洁有力，具有说服力",
    category: "营销",
    tags: ["产品", "营销", "介绍"],
  },
  {
    id: "4",
    title: "健身励志文案",
    description: "健身运动相关的励志内容",
    content:
      "创作一段关于{运动类型}的励志文案：\n1. 激发运动热情\n2. 强调坚持的重要性\n3. 分享运动带来的好处\n4. 语言正能量，鼓舞人心\n5. 适合健身社群分享",
    category: "健身",
    tags: ["健身", "励志", "运动"],
  },
  {
    id: "5",
    title: "科技产品评测",
    description: "数码产品的专业评测文案",
    content:
      "请为{产品名称}写一份评测文案：\n1. 外观设计分析\n2. 功能特性介绍\n3. 性能测试结果\n4. 优缺点总结\n5. 购买建议\n语言专业客观，逻辑清晰",
    category: "科技",
    tags: ["科技", "评测", "数码"],
    isPopular: true,
  },
  {
    id: "6",
    title: "生活小技巧分享",
    description: "实用的生活窍门和技巧",
    content:
      "分享一个关于{生活场景}的实用小技巧：\n1. 问题场景描述\n2. 解决方法步骤\n3. 注意事项\n4. 效果说明\n5. 语言通俗易懂，实用性强",
    category: "生活",
    tags: ["生活", "技巧", "实用"],
  },
]

const categories = ["全部", "美食", "旅游", "营销", "健身", "科技", "生活"]

interface PromptTemplateLibraryProps {
  onSelectTemplate: (template: PromptTemplate) => void
  onInjectToChat?: (content: string) => void
  onInjectToEditor?: (content: string) => void
}

export function PromptTemplateLibrary({ onSelectTemplate, onInjectToChat }: PromptTemplateLibraryProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("全部")

  const filteredTemplates = promptTemplates.filter((template) => {
    const matchesSearch =
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === "全部" || template.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const popularTemplates = promptTemplates.filter((template) => template.isPopular)

  const handleSelectTemplate = (template: PromptTemplate) => {
    onSelectTemplate(template)
    // 统一输入入口：默认仅注入聊天输入框（Composer）
    onInjectToChat?.(template.content)
    setOpen(false)
  }

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
          <Wand2 className="h-3 w-3" />
          <span className="text-xs">模板</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Prompt模板库
          </DialogTitle>
          <DialogDescription>选择合适的模板快速开始创作，或者从中获取灵感</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索栏 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-7">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4">
                  {selectedCategory === "全部" && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <h3 className="font-medium">热门模板</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {popularTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="border border-border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleSelectTemplate(template)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-sm">{template.title}</h4>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyTemplate(template.content)
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                              {template.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="border border-border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{template.title}</h4>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyTemplate(template.content)
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {template.isPopular && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{template.description}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {template.category}
                          </Badge>
                          {template.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">未找到匹配的模板</p>
                      <p className="text-sm text-muted-foreground mt-1">尝试调整搜索关键词或选择其他分类</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">共 {filteredTemplates.length} 个模板</div>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Plus className="h-3 w-3" />
              自定义模板
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
