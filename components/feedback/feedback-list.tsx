"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ThumbsUp, MessageSquare, Clock, User, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Feedback {
  id: string
  title: string
  content: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  author: string
  contactInfo: string
  upvotes: number
  tags: string[]
  replies: Array<{
    id: string
    content: string
    author: string
    createdAt: string
    isAdmin: boolean
  }>
}

interface FeedbackListProps {
  showAdminActions?: boolean
}

export function FeedbackList({ showAdminActions = false }: FeedbackListProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const { toast } = useToast()

  const categories = ["all", "功能建议", "问题报告", "使用体验", "性能优化", "界面设计"]
  const statuses = ["all", "pending", "in-progress", "resolved", "closed"]

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        category: categoryFilter,
        status: statusFilter,
        page: currentPage.toString(),
        limit: "10",
      })

      const response = await fetch(`/api/feedback?${params}`)
      const result = await response.json()

      if (result.success) {
        setFeedbacks(result.data.feedbacks)
        setTotalPages(result.data.totalPages)
      }
    } catch (error) {
      toast({
        title: "获取反馈列表失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedbacks()
  }, [categoryFilter, statusFilter, currentPage])

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
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case "pending":
        return "待处理"
      case "in-progress":
        return "处理中"
      case "resolved":
        return "已解决"
      case "closed":
        return "已关闭"
      default:
        return "未知"
    }
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "medium":
        return "bg-blue-100 text-blue-800"
      case "low":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityText = (priority: string): string => {
    switch (priority) {
      case "urgent":
        return "紧急"
      case "high":
        return "高"
      case "medium":
        return "中"
      case "low":
        return "低"
      default:
        return "未知"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="反馈类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {categories.slice(1).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="in-progress">处理中</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
                <SelectItem value="closed">已关闭</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 反馈列表 */}
      <div className="space-y-4">
        {feedbacks.map((feedback) => (
          <Card key={feedback.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-1">{feedback.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{feedback.category}</Badge>
                    <Badge className={getStatusColor(feedback.status)}>{getStatusText(feedback.status)}</Badge>
                    <Badge className={getPriorityColor(feedback.priority)}>{getPriorityText(feedback.priority)}</Badge>
                  </div>
                </div>
                {feedback.replies.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>已回复</span>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{feedback.content}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{feedback.author}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(feedback.createdAt)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        查看详情
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{feedback.title}</DialogTitle>
                      </DialogHeader>
                      <FeedbackDetail feedback={feedback} showAdminActions={showAdminActions} />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {feedbacks.length === 0 && (
        <div className="text-center py-12">
          <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">没有找到符合条件的反馈</p>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </Button>
          <span className="flex items-center px-3 text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}

function FeedbackDetail({ feedback, showAdminActions }: { feedback: Feedback; showAdminActions: boolean }) {
  const [reply, setReply] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const handleReply = async () => {
    if (!reply.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/feedback/${feedback.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reply: reply.trim() }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "回复成功",
          description: "回复已发送",
        })
        setReply("")
      }
    } catch (error) {
      toast({
        title: "回复失败",
        description: "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">反馈内容</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback.content}</p>
      </div>

      {feedback.contactInfo && (
        <div>
          <h4 className="font-medium mb-2">联系方式</h4>
          <p className="text-sm text-muted-foreground">{feedback.contactInfo}</p>
        </div>
      )}

      {feedback.replies.length > 0 && feedback.replies[0] && (
        <div>
          <h4 className="font-medium mb-2">处理回复</h4>
          <div className="border-l-2 border-primary/20 pl-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                系统回复
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(feedback.replies[0].createdAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{feedback.replies[0].content}</p>
          </div>
        </div>
      )}

      {showAdminActions && (
        <div>
          <h4 className="font-medium mb-2">管理员回复</h4>
          <div className="space-y-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="输入回复内容..."
              className="min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button onClick={handleReply} disabled={submitting || !reply.trim()}>
                {submitting ? "发送中..." : "发送回复"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString("zh-CN")
  }
}
