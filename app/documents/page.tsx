"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/ui/page-transition"
import { ConnectionStatus } from "@/components/ui/connection-status"
import dynamic from 'next/dynamic'

// 懒加载重型组件
const MarkdownEditor = dynamic(() => import("@/components/documents/markdown-editor").then(mod => ({ default: mod.MarkdownEditor })), {
  loading: () => (
    <div className="h-96 bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-muted-foreground">加载编辑器中...</div>
    </div>
  ),
  ssr: false // 编辑器不需要SSR
})
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Download,
  ChevronDown,
  SortAsc,
  ArrowLeft,
  Folder,
} from "lucide-react"

type ViewMode = "grid" | "edit" | "create"
type SortBy = "recent" | "created" | "title" | "modified"

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
  folderId: string
}

interface Folder {
  id: string
  name: string
  icon: string
  count: number
  children?: Folder[]
}

const mockFolders: Folder[] = [
  { id: "all", name: "所有文档", icon: "", count: 24 },
  { id: "recent", name: "最近打开", icon: "", count: 8 },
  { id: "favorites", name: "收藏夹", icon: "", count: 5 },
  { id: "ai-generated", name: "AI生成", icon: "", count: 12 },
  {
    id: "categories",
    name: "分类",
    icon: "",
    count: 0,
    children: [
      { id: "video-scripts", name: "短视频文案", icon: "", count: 8 },
      { id: "product-intro", name: "产品介绍", icon: "", count: 6 },
      { id: "travel-guides", name: "旅游攻略", icon: "", count: 4 },
      { id: "food-content", name: "美食内容", icon: "", count: 6 },
    ],
  },
  { id: "trash", name: "回收站", icon: "", count: 3 },
]

const mockDocuments: Document[] = []

export default function DocumentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [selectedFolder, setSelectedFolder] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("recent")
  // 本地状态管理：文档与分类（扁平）
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState("")
  // 移动到分类对话框状态
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [movingDoc, setMovingDoc] = useState<Document | null>(null)
  const [targetCategory, setTargetCategory] = useState<string>("")
  const [moveNewCategory, setMoveNewCategory] = useState("")
  const [undoSnapshot, setUndoSnapshot] = useState<{ documents: Document[]; categories: string[] } | null>(null)
  const { toast } = useToast()

  // localStorage keys & version
  const LS_VERSION = 1
  const DOCS_KEY = `documents_v${LS_VERSION}`
  const CATS_KEY = `categories_v${LS_VERSION}`

  // 工具：捕获当前状态快照
  const captureSnapshot = () => ({
    documents: documents.map((d) => ({ ...d })),
    categories: [...categories],
  })
  // 初始化：从 localStorage 读取
  useEffect(() => {
    try {
      const rawDocs = typeof window !== 'undefined' ? window.localStorage.getItem(DOCS_KEY) : null
      const rawCats = typeof window !== 'undefined' ? window.localStorage.getItem(CATS_KEY) : null

      if (rawDocs) {
        try {
          const parsed = JSON.parse(rawDocs)
          if (Array.isArray(parsed)) {
            setDocuments(parsed)
          }
        } catch (e) {
          }
      }

      if (rawCats) {
        try {
          const parsed = JSON.parse(rawCats)
          if (Array.isArray(parsed)) {
            setCategories(parsed)
          }
        } catch (e) {
          }
      }
    } catch (err) {
      }
  }, [])

  // 同步：documents 变化时写入 localStorage（节流可选，这里直接写入）
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(DOCS_KEY, JSON.stringify(documents))
    } catch (err) {
      }
  }, [documents])

  // 同步：categories 变化时写入 localStorage
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(CATS_KEY, JSON.stringify(categories))
    } catch (err) {
      }
  }, [categories])


  const handleCreateNew = () => {
    setSelectedDocument(null)
    setViewMode("create")
  }

  const handleEdit = (document: Document) => {
    setSelectedDocument(document)
    setViewMode("edit")
  }

  const handleSave = (doc: any) => {
    // 快照：保存前状态（用于撤销编辑/保存）
    setUndoSnapshot(captureSnapshot())

    // 保存或更新文档
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === doc.id)
      if (exists) {
        return prev.map((d) => (d.id === doc.id ? { ...doc } : d))
      }
      return [{ ...doc }, ...prev]
    })

    // 同步分类（如有新分类则追加）
    if (doc.category && !categories.includes(doc.category)) {
      setCategories((prev) => [...prev, doc.category])
    }

    toast({
      title: "已保存",
      description: "文档已保存（可撤销）",
      action: <ToastAction altText="撤销保存" onClick={undoLast}>撤销</ToastAction>,
    })

    setViewMode("grid")
    setSelectedDocument(null)
  }

  const handleCancel = () => {
    setViewMode("grid")
    setSelectedDocument(null)
  }

  const handleAddCategory = () => {
    const name = newCategory.trim()
    if (!name) return

    // 快照
    setUndoSnapshot(captureSnapshot())

    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name])
    }
    setNewCategory("")

    toast({
      title: "已添加分类",
      description: `已创建分类：${name}（可撤销）`,
      action: <ToastAction altText="撤销创建分类" onClick={() => undoLast()}>撤销</ToastAction>,
    })
  }

  const undoLast = () => {
    if (!undoSnapshot) return
    setDocuments(undoSnapshot.documents)
    setCategories(undoSnapshot.categories)
    setUndoSnapshot(null)
    toast({ title: "已撤销", description: "操作已撤销" })
  }

  const handleDelete = (id: string) => {
    // 保存快照
    const snapshot = { documents: documents.map((d) => ({ ...d })), categories: [...categories] }
    setUndoSnapshot(snapshot)

    // 删除文档
    setDocuments((prev) => prev.filter((d) => d.id !== id))

    // Toast 提供撤销
    toast({
      title: "已删除",
      description: "文档已删除（可撤销）",
      action: (
        <ToastAction altText="撤销删除" onClick={undoLast}>
          撤销
        </ToastAction>
      ),
    })
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedFolder === "all" || (doc.category || "") === selectedFolder

    return matchesSearch && matchesCategory
  })

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case "created":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "title":
        return a.title.localeCompare(b.title)
      case "modified":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      default:
        return 0
    }
  })



  if (viewMode === "edit" || viewMode === "create") {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="container mx-auto py-4">
            <div className="flex items-center justify-end mb-4">
              <Button variant="outline" onClick={() => setViewMode("grid")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
            </div>
          </div>
          <MarkdownEditor document={selectedDocument || undefined} onSave={handleSave} onCancel={handleCancel} />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* 连接状态指示器 - 文档页面 */}
        <ConnectionStatus
          position="fixed"
          size="sm"
          className="top-20 right-4 z-[45]"
          animated={true}
          showDetails={false}
          autoHideWhenHealthy={true}
        />

        <div className="container mx-auto py-4" />

        <div className="flex h-[calc(100vh-120px)]">
          <div className="w-64 border-r border-border bg-background flex-shrink-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">分类</h2>
                <Button size="sm" onClick={handleCreateNew} className="gap-1 h-7 px-2">
                  <Plus className="h-3 w-3" />
                  <span className="text-xs">新建文档</span>
                </Button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="新建分类..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddCategory}>
                  添加
                </Button>
              </div>

              <ScrollArea className="h-[calc(100vh-170px)]">
                <div className="space-y-1">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedFolder === "all" ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedFolder("all")}
                  >
                    <span className="text-sm flex-1">全部</span>
                    <Badge variant="secondary" className="text-xs">
                      {documents.length}
                    </Badge>
                  </div>

                  {categories.map((cat) => {
                    const count = documents.filter((d) => (d.category || "") === cat).length
                    return (
                      <div
                        key={cat}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedFolder === cat ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedFolder(cat)}
                      >
                        <span className="text-sm flex-1">{cat}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {/* 工具栏 */}
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {selectedFolder === "all" ? "全部文档" : selectedFolder || "未分类"}
                  </h1>
                  <p className="text-sm text-muted-foreground">共 {sortedDocuments.length} 个文档</p>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                        <SortAsc className="h-4 w-4" />
                        排序
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setSortBy("recent")}>
                        <Clock className="h-4 w-4 mr-2" />
                        最近打开
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("created")}>
                        <Calendar className="h-4 w-4 mr-2" />
                        创建时间
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("title")}>
                        <FileText className="h-4 w-4 mr-2" />
                        标题
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy("modified")}>
                        <Edit className="h-4 w-4 mr-2" />
                        修改时间
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文档..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 文档网格 */}
            <ScrollArea className="flex-1 p-4">
              {sortedDocuments.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium text-foreground mb-2">暂无文档</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery ? "未找到匹配的文档" : "开始创建您的第一个文档"}
                    </p>
                    <Button onClick={handleCreateNew} className="gap-2">
                      <Plus className="h-4 w-4" />
                      新建文档
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedDocuments.map((document) => (
                    <Card key={document.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">{document.title}</CardTitle>
                            <div className="text-xs mt-1 flex items-center gap-2">
                              <Select
                                value={(document.category && document.category.length > 0) ? document.category : "__UNCATEGORIZED__"}
                                onValueChange={(v) => {
                                  // 保存快照
                                  setUndoSnapshot(captureSnapshot())
                                  const newCategory = v === "__UNCATEGORIZED__" ? "" : v
                                  setDocuments((prev) => prev.map((d) => d.id === document.id ? { ...d, category: newCategory } : d))
                                  if (newCategory && !categories.includes(newCategory)) {
                                    setCategories((prev) => [...prev, newCategory])
                                  }
                                  toast({
                                    title: "分类已更新",
                                    description: `已将文档分类设置为 ${newCategory || "无分类"}`,
                                    action: (<ToastAction altText="撤销分类变更" onClick={undoLast}>撤销</ToastAction>),
                                  })
                                }}
                              >
                                <SelectTrigger className="h-6 px-2 py-0 text-xs w-auto min-w-[80px]">
                                  <SelectValue placeholder="选择分类" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__UNCATEGORIZED__">无分类</SelectItem>
                                  {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleEdit(document)}>
                                <Edit className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setMovingDoc(document); setTargetCategory(document.category && document.category.length > 0 ? document.category : "__UNCATEGORIZED__"); setMoveDialogOpen(true) }}>
                                <Folder className="h-4 w-4 mr-2" />
                                移动到分类
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="h-4 w-4 mr-2" />
                                复制
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                导出
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(document.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0" onClick={() => handleEdit(document)}>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {document.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {document.aiGenerated && (
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">
                                AI
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center justify-between">
                              <span>字数: {document.wordCount}</span>
                              <span>v{document.version}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>{document.updatedAt}</span>
                              <Badge
                                variant={document.status === "已发布" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {document.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* 移动到分类 对话框 */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动到分类</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="新建分类..."
                value={moveNewCategory}
                onChange={(e) => setMoveNewCategory(e.target.value)}
                className="h-9"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const name = moveNewCategory.trim()
                  if (!name) return
                  // 快照
                  setUndoSnapshot(captureSnapshot())

                  if (!categories.includes(name)) {
                    setCategories((prev) => [...prev, name])
                  }
                  setTargetCategory(name)
                  setMoveNewCategory("")
                  toast({
                    title: "已添加分类",
                    description: `已创建分类：${name}（可撤销）`,
                    action: (
                      <ToastAction altText="撤销创建分类" onClick={undoLast}>
                        撤销
                      </ToastAction>
                    ),
                  })
                }}
              >
                添加新分类
              </Button>
            </div>

            <Select value={targetCategory} onValueChange={(v) => setTargetCategory(v)}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__UNCATEGORIZED__">无分类</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>取消</Button>
              <Button
                onClick={() => {
                  if (!movingDoc) return

                  // 保存快照
                  const snapshot = { documents: documents.map((d) => ({ ...d })), categories: [...categories] }
                  setUndoSnapshot(snapshot)

                  const newCategory = targetCategory === "__UNCATEGORIZED__" ? "" : targetCategory

                  // 更新文档分类
                  setDocuments((prev) => prev.map((d) => (d.id === movingDoc.id ? { ...d, category: newCategory } : d)))

                  // 分类列表维护：目标分类若不存在且非空，加入；无需从列表删除旧分类（可能仍被其他文档使用）
                  if (newCategory && !categories.includes(newCategory)) {
                    setCategories((prev) => [...prev, newCategory])
                  }

                  setMoveDialogOpen(false)
                  setMovingDoc(null)
                  toast({
                    title: "已移动",
                    description: `文档已移动到 ${newCategory || "无分类"}`,
                    action: (
                      <ToastAction altText="撤销移动" onClick={undoLast}>
                        撤销
                      </ToastAction>
                    ),
                  })
                }}
              >
                确认移动
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
