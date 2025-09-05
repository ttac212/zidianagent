"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Edit, Trash2, Download, Eye, Clock, User, Hash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Document {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  version: number
  wordCount: number
  status: string
  author: string
  aiGenerated: boolean
}

interface DocumentListProps {
  onEdit?: (document: Document) => void
  onView?: (document: Document) => void
}

export function DocumentList({ onEdit, onView }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("updatedAt")
  const { toast } = useToast()

  const categories = ["all", "短视频文案", "营销文案", "产品介绍", "教程内容", "创意脚本"]

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        category: selectedCategory,
        search: searchTerm,
      })

      const response = await fetch(`/api/documents?${params}`)
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data)
      }
    } catch (error) {
      toast({
        title: "获取文档失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [selectedCategory, searchTerm])

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个文档吗？")) return

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "删除成功",
          description: "文档已删除",
        })
        fetchDocuments()
      }
    } catch (error) {
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    }
  }

  const handleExport = (document: Document) => {
    const content = `# ${document.title}\n\n分类: ${document.category}\n标签: ${document.tags.join(", ")}\n作者: ${document.author}\n创建时间: ${new Date(document.createdAt).toLocaleString("zh-CN")}\n\n---\n\n${document.content}`

    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement("a")
    a.href = url
    a.download = `${document.title}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "刚刚"
    if (diffInHours < 24) return `${diffInHours}小时前`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}天前`
    return date.toLocaleDateString("zh-CN")
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800"
      case "draft":
        return "bg-yellow-100 text-yellow-800"
      case "archived":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case "published":
        return "已发布"
      case "draft":
        return "草稿"
      case "archived":
        return "已归档"
      default:
        return "未知"
    }
  }

  // 排序文档
  const sortedDocuments = [...documents].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title)
      case "createdAt":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "updatedAt":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case "wordCount":
        return b.wordCount - a.wordCount
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文档标题或内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.slice(1).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">更新时间</SelectItem>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="title">标题</SelectItem>
                  <SelectItem value="wordCount">字数</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 文档列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedDocuments.map((document) => (
          <Card key={document.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg line-clamp-2 flex-1">{document.title}</CardTitle>
                <div className="flex items-center gap-1 ml-2">
                  {document.aiGenerated && (
                    <Badge variant="outline" className="text-xs">
                      AI
                    </Badge>
                  )}
                  <Badge className={`text-xs ${getStatusColor(document.status)}`}>
                    {getStatusText(document.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground line-clamp-3">{document.content}</div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>{document.wordCount}字</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>v{document.version}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{document.author}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {document.category}
                  </Badge>
                  {document.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(document.updatedAt)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onView?.(document)}>
                  <Eye className="h-3 w-3 mr-1" />
                  查看
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit?.(document)}>
                  <Edit className="h-3 w-3 mr-1" />
                  编辑
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport(document)}>
                  <Download className="h-3 w-3 mr-1" />
                  导出
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(document.id)}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedDocuments.length === 0 && (
        <div className="text-center py-12">
          <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">没有找到符合条件的文档</p>
        </div>
      )}
    </div>
  )
}
