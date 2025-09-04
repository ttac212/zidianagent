"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/ui/page-transition"
import { ConnectionStatus } from "@/components/ui/connection-status"
import { useMobile } from "@/hooks/use-mobile"
import { 
  Heart, Search, Eye, MessageSquare, Bookmark, Share2, 
  TrendingUp, Calendar, User, Clock, BarChart3, Hash,
  ChevronDown, ChevronUp, ExternalLink, PlayCircle,
  FileText, AlertCircle
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

interface Comment {
  评论ID: string
  评论时间: string
  评论内容: string
  点赞数量: number
  回复数量: number
  IP归属地: string
}

interface Video {
  id: string
  desc: string
  create_time: string
  nickname: string
  digg_count: number
  comment_count: number
  collect_count: number
  share_count: number
  share_url: string
  text_extra: string[]
  视频时长: string
  评论详细信息: Comment[]
  comment_count_actual: number
}

interface KeywordData {
  keyword_info: {
    keyword: string
    category: string
  }
  videos: Video[]
  statistics: {
    总视频数: number
    总点赞数: number
    总评论数: number
    总收藏数: number
    总分享数: number
    实际评论总数: number
    平均点赞数: number
    平均评论数: number
    平均收藏数: number
    平均分享数: number
    最早发布: string
    最新发布: string
    主要标签: string[]
    主要创作者: string[]
  }
  metadata: {
    created_at: string
    last_updated: string
    total_videos: number
  }
}

interface ApiResponse {
  success: boolean
  data?: KeywordData
  availableKeywords?: string[]
  currentKeyword?: string
  message?: string
}

export default function InspirationPage() {
  const [loading, setLoading] = useState(true)
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null)
  const [availableKeywords, setAvailableKeywords] = useState<string[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState("断桥铝门窗")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [expandedComments, setExpandedComments] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("videos")
  const isMobile = useMobile()

  // 获取关键字数据
  const fetchKeywordData = async (keyword: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/keyword-data?keyword=${encodeURIComponent(keyword)}`)
      const result: ApiResponse = await response.json()
      
      if (result.success && result.data) {
        setKeywordData(result.data)
        if (result.availableKeywords) {
          setAvailableKeywords(result.availableKeywords)
        }
      } else {
        }
    } catch (error) {
      } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeywordData(selectedKeyword)
  }, [selectedKeyword])

  // 搜索过滤
  const filteredVideos = keywordData?.videos.filter(video => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      video.desc.toLowerCase().includes(query) ||
      video.nickname.toLowerCase().includes(query) ||
      video.text_extra.some(tag => tag.toLowerCase().includes(query))
    )
  }) || []

  // 切换评论展开
  const toggleComments = (videoId: string) => {
    setExpandedComments(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    )
  }

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  // 获取评论热点
  const getCommentInsights = () => {
    if (!keywordData) return { questions: [], topics: [] }
    
    const allComments = keywordData.videos.flatMap(v => v.评论详细信息)
    
    // 提取问题（包含问号的评论）
    const questions = allComments
      .filter(c => c.评论内容.includes('?') || c.评论内容.includes('？'))
      .sort((a, b) => (b.点赞数量 || 0) - (a.点赞数量 || 0))
      .slice(0, 5)
    
    // 提取高频词
    const wordCount: Record<string, number> = {}
    const stopWords = ['的', '了', '吗', '这个', '是', '有', '我', '你', '在', '和', '就', '都', '也', '还', '吧', '啊']
    
    allComments.forEach(comment => {
      const words = comment.评论内容.match(/[\u4e00-\u9fa5]{2,}/g) || []
      words.forEach(word => {
        if (!stopWords.includes(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1
        }
      })
    })
    
    const topics = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }))
    
    return { questions, topics }
  }

  const { questions, topics } = getCommentInsights()

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container mx-auto py-8 px-4">
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 mx-auto" />
              <Skeleton className="h-4 w-96 mx-auto" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* 连接状态指示器 - 视频内容洞察页面 */}
        <ConnectionStatus
          position="fixed"
          size="sm"
          className="top-20 right-4 z-[45]"
          animated={true}
          showDetails={false}
          autoHideWhenHealthy={true}
        />

        <main className="container mx-auto py-4 md:py-8 px-4">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* 页面标题 */}
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">视频内容洞察</h1>
              <p className="text-sm md:text-base text-muted-foreground">深度分析视频内容趋势，洞察用户需求与关注点</p>
            </div>

            {/* 关键字选择和搜索 */}
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedKeyword} onValueChange={setSelectedKeyword}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="选择关键字" />
                </SelectTrigger>
                <SelectContent>
                  {availableKeywords.map(keyword => (
                    <SelectItem key={keyword} value={keyword}>
                      {keyword}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索视频内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {keywordData && (
              <>
                {/* 数据统计卡片 */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        视频总数
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{keywordData.statistics.总视频数}</div>
                      <p className="text-xs text-muted-foreground">
                        {keywordData.statistics.最早发布} - {keywordData.statistics.最新发布}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        总互动量
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(keywordData.statistics.总点赞数 + keywordData.statistics.总评论数)}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>❤️ {formatNumber(keywordData.statistics.总点赞数)}</span>
                        <span>💬 {formatNumber(keywordData.statistics.总评论数)}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        平均互动率
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatNumber(keywordData.statistics.平均点赞数)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        平均每个视频点赞数
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        主要创作者
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium truncate">
                        {keywordData.statistics.主要创作者[0] || '暂无'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        共 {keywordData.statistics.主要创作者.length} 位创作者
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 标签云 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">热门标签</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {keywordData.statistics.主要标签.map(tag => (
                        <Badge key={tag} variant="secondary">
                          <Hash className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 主要内容区域 */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="videos">视频列表</TabsTrigger>
                    <TabsTrigger value="comments">评论分析</TabsTrigger>
                    <TabsTrigger value="insights">热点洞察</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="videos" className="space-y-4">
                    {filteredVideos.length === 0 ? (
                      <Card>
                        <CardContent className="text-center py-8">
                          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">未找到相关视频</p>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredVideos.map((video) => (
                        <Card key={video.id} className="overflow-hidden">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">
                                    <User className="h-3 w-3 mr-1" />
                                    {video.nickname}
                                  </Badge>
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {video.视频时长}
                                  </Badge>
                                  <Badge variant="outline">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {video.create_time.split(' ')[0]}
                                  </Badge>
                                </div>
                                <p className="text-sm line-clamp-2">{video.desc}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a href={video.share_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {/* 标签 */}
                            <div className="flex flex-wrap gap-1 mb-4">
                              {video.text_extra.slice(0, 5).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            {/* 数据统计 */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              <div className="text-center">
                                <div className="text-lg font-semibold">{formatNumber(video.digg_count)}</div>
                                <div className="text-xs text-muted-foreground">点赞</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold">{formatNumber(video.comment_count)}</div>
                                <div className="text-xs text-muted-foreground">评论</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold">{formatNumber(video.collect_count)}</div>
                                <div className="text-xs text-muted-foreground">收藏</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold">{formatNumber(video.share_count)}</div>
                                <div className="text-xs text-muted-foreground">分享</div>
                              </div>
                            </div>
                            
                            {/* 评论展示 */}
                            {video.comment_count_actual > 0 && (
                              <div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => toggleComments(video.id)}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  {expandedComments.includes(video.id) ? '收起' : '查看'} {video.comment_count_actual} 条评论
                                  {expandedComments.includes(video.id) ? (
                                    <ChevronUp className="h-4 w-4 ml-2" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                  )}
                                </Button>
                                
                                {expandedComments.includes(video.id) && (
                                  <ScrollArea className="h-64 mt-4 rounded-md border p-4">
                                    <div className="space-y-3">
                                      {video.评论详细信息.map((comment) => (
                                        <div key={comment.评论ID} className="border-b pb-3 last:border-0">
                                          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                                            <span>{comment.IP归属地}</span>
                                            <span>·</span>
                                            <span>{comment.评论时间}</span>
                                            {comment.点赞数量 > 0 && (
                                              <>
                                                <span>·</span>
                                                <span className="flex items-center gap-1">
                                                  <Heart className="h-3 w-3" />
                                                  {comment.点赞数量}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                          <p className="text-sm">{comment.评论内容}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="comments" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">用户常见问题</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {questions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">暂无用户问题</p>
                          ) : (
                            questions.map((comment, idx) => (
                              <div key={idx} className="border-l-2 border-primary pl-3">
                                <p className="text-sm">{comment.评论内容}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>{comment.IP归属地}</span>
                                  {comment.点赞数量 > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Heart className="h-3 w-3" />
                                      {comment.点赞数量}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">全部评论</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-96">
                          <div className="space-y-3">
                            {keywordData.videos.flatMap(v => v.评论详细信息).map((comment) => (
                              <div key={comment.评论ID} className="border-b pb-3 last:border-0">
                                <p className="text-sm mb-1">{comment.评论内容}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{comment.IP归属地}</span>
                                  <span>{comment.评论时间}</span>
                                  {comment.点赞数量 > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Heart className="h-3 w-3" />
                                      {comment.点赞数量}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="insights" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">高频词汇分析</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {topics.map((topic, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{topic.word}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-32 bg-secondary rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full"
                                    style={{ width: `${(topic.count / topics[0]?.count) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                  {topic.count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">内容洞察总结</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium mb-1">发布时间分布</h4>
                          <p className="text-sm text-muted-foreground">
                            最早发布: {keywordData.statistics.最早发布}<br />
                            最新发布: {keywordData.statistics.最新发布}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-1">创作者分布</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {keywordData.statistics.主要创作者.map(creator => (
                              <Badge key={creator} variant="outline">
                                {creator}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-1">互动表现</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div>平均点赞: {formatNumber(keywordData.statistics.平均点赞数)}</div>
                            <div>平均评论: {formatNumber(keywordData.statistics.平均评论数)}</div>
                            <div>平均收藏: {formatNumber(keywordData.statistics.平均收藏数)}</div>
                            <div>平均分享: {formatNumber(keywordData.statistics.平均分享数)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
      </div>
    </PageTransition>
  )
}