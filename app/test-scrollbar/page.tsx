"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Bot, User, Code, AlertTriangle, HelpCircle, Clock, Calendar } from 'lucide-react'
import Link from 'next/link'

// 模拟消息类型
interface TestMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// 时间轴数据点
interface TimelinePoint {
  messageId: string
  index: number
  percentage: number
  timestamp: number
  date: Date
  isAIMessage: boolean
}

// 生成模拟对话数据 - 支持不同数量测试
const generateTestMessages = (count: number = 120): TestMessage[] => {
  const messages: TestMessage[] = []
  const baseTime = Date.now() - 24 * 60 * 60 * 1000 // 24小时前开始
  
  const sampleContents = [
    { role: 'user', content: '你好，我想了解一下React hooks的使用？' },
    { role: 'assistant', content: 'React hooks是React 16.8引入的新特性，它允许你在函数组件中使用state和其他React特性。最常用的hooks包括useState、useEffect、useContext等。' },
    { role: 'user', content: '能给我一个useState的例子吗？' },
    { role: 'assistant', content: '当然可以！这是一个简单的计数器例子：\n\n```jsx\nimport React, { useState } from \'react\';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  \n  return (\n    <div>\n      <p>你点击了 {count} 次</p>\n      <button onClick={() => setCount(count + 1)}>\n        点击我\n      </button>\n    </div>\n  );\n}\n```' },
    { role: 'user', content: '这个例子很清楚！那useEffect是做什么的？' },
    { role: 'assistant', content: 'useEffect hook用于在函数组件中执行副作用操作，比如数据获取、订阅或手动更改React组件的DOM。它相当于类组件中的componentDidMount、componentDidUpdate和componentWillUnmount的组合。' },
    { role: 'user', content: '有时候我的useEffect会无限循环，这是为什么？' },
    { role: 'assistant', content: '无限循环通常是由于依赖数组配置不当引起的。如果你在useEffect内部修改了依赖数组中的值，就会导致无限循环。' },
    { role: 'user', content: '能举个具体的错误例子吗？' },
    { role: 'assistant', content: '这是一个会导致无限循环的错误示例：\n\n```jsx\n// ❌ 错误示例\nconst [data, setData] = useState([]);\nuseEffect(() => {\n  setData([...data, \'new item\']);\n}, [data]);\n```' },
    { role: 'user', content: '原来如此！那如何在useEffect中获取数据？' },
    { role: 'assistant', content: '在useEffect中获取数据是很常见的操作。由于useEffect不能直接是async函数，我们需要在内部定义异步函数。' },
    { role: 'user', content: '非常有帮助！还有其他重要的hooks吗？' },
    { role: 'assistant', content: '是的，还有很多有用的hooks：useContext、useReducer、useCallback、useMemo、useRef、useLayoutEffect等。' },
    { role: 'user', content: '我想深入学习useReducer，它什么时候比useState更好？' },
    { role: 'assistant', content: 'useReducer在复杂状态逻辑、状态转换依赖于之前的状态等情况下比useState更适合。' },
    { role: 'user', content: '能给我看看useContext的使用场景吗？' },
    { role: 'assistant', content: 'useContext主要用于跨组件共享状态，避免props drilling问题。它让你可以在任何子组件中直接访问上层提供的状态。' },
    { role: 'user', content: '什么是props drilling？' },
    { role: 'assistant', content: 'Props drilling是指为了将数据传递给深层嵌套的子组件，需要通过多个中间组件一层层传递props的现象。' },
    { role: 'user', content: '那useCallback和useMemo有什么区别？' },
    { role: 'assistant', content: 'useCallback缓存函数引用，useMemo缓存计算结果。useCallback返回函数，useMemo返回值。' },
    { role: 'user', content: '什么时候需要使用useRef？' },
    { role: 'assistant', content: 'useRef用于访问DOM元素、保存可变值而不触发重新渲染、或在函数组件中保存实例变量。' },
    { role: 'user', content: 'useLayoutEffect和useEffect有什么不同？' },
    { role: 'assistant', content: 'useLayoutEffect在DOM更新后、浏览器绘制前同步执行，而useEffect在绘制后异步执行。' }
  ]
  
  // 生成指定数量的消息
  for (let i = 0; i < count; i++) {
    const template = sampleContents[i % sampleContents.length]
    const variation = Math.floor(i / sampleContents.length)
    
    messages.push({
      id: `msg-${i}`,
      role: template.role as 'user' | 'assistant',
      content: variation > 0 
        ? `${template.content} (第${variation + 1}轮对话)` 
        : template.content,
      timestamp: baseTime + (i * 5 * 60 * 1000) // 每5分钟一条消息
    })
  }
  
  return messages
}

// 时间轴滚动条组件
// 判断是否为AI消息（移到组件外部）
const isAIMessage = (message: TestMessage): boolean => {
  return message.role === 'assistant'
}

const TimelineScrollbar: React.FC<{
  messages: TestMessage[]
  currentMessageId?: string
  onJumpToMessage: (messageId: string) => void
  containerHeight: number
}> = ({ messages, currentMessageId, onJumpToMessage, containerHeight }) => {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [hoverMessage, setHoverMessage] = useState<TestMessage | null>(null)
  
  // 智能采样策略 - 动态密度控制
  const timelineData = useMemo((): TimelinePoint[] => {
    if (messages.length === 0) return []
    
    const firstTime = messages[0].timestamp
    const lastTime = messages[messages.length - 1].timestamp
    const totalDuration = lastTime - firstTime
    
    // 根据消息数量决定采样策略
    let samplesToShow: TestMessage[] = []
    
    if (messages.length < 50) {
      // < 50条：显示所有圆点
      samplesToShow = messages
    } else if (messages.length <= 100) {
      // 50-100条：每2条显示1个圆点
      samplesToShow = messages.filter((_, index) => index % 2 === 0)
    } else {
      // > 100条：按时间段分组显示 (每10条取1个代表)
      const step = Math.max(1, Math.floor(messages.length / 20)) // 最多显示20个代表点
      samplesToShow = messages.filter((_, index) => index % step === 0)
      
      // 确保包含最后一条消息
      if (samplesToShow[samplesToShow.length - 1]?.id !== messages[messages.length - 1]?.id) {
        samplesToShow.push(messages[messages.length - 1])
      }
    }
    
    return samplesToShow.map((message) => {
      const originalIndex = messages.findIndex(m => m.id === message.id)
      const relativeTime = message.timestamp - firstTime
      const percentage = totalDuration > 0 ? (relativeTime / totalDuration) * 100 : 0
      
      return {
        messageId: message.id,
        index: originalIndex,
        percentage,
        timestamp: message.timestamp,
        date: new Date(message.timestamp),
        isAIMessage: isAIMessage(message)
      }
    })
  }, [messages])
  
  // 优化双色系统 - 保持协调的适度对比
  const getMessageColor = (message: TestMessage, isActive: boolean) => {
    if (isActive) return 'bg-orange-500 shadow-2xl ring-4 ring-orange-200 scale-125'
    
    if (message.role === 'assistant') {
      // AI消息：饱和蓝色 - 保持项目主色调
      return 'bg-blue-500 hover:bg-blue-600 hover:shadow-lg shadow-sm'
    } else {
      // 用户消息：温和灰色 - 与蓝色形成平衡对比
      return 'bg-gray-500 hover:bg-gray-600 hover:shadow-lg shadow-sm'
    }
  }
  
  // 处理鼠标悬停
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const hoverY = e.clientY - rect.top
    const percentage = (hoverY / rect.height) * 100
    
    setHoverPosition(percentage)
    
    // 找到最接近的消息
    const closestPoint = timelineData.reduce((closest, current) => {
      const currentDiff = Math.abs(current.percentage - percentage)
      const closestDiff = Math.abs(closest.percentage - percentage)
      return currentDiff < closestDiff ? current : closest
    })
    
    const message = messages.find(m => m.id === closestPoint.messageId)
    setHoverMessage(message || null)
  }
  
  // 处理点击跳转
  const handleClick = (e: React.MouseEvent) => {
    if (hoverMessage) {
      onJumpToMessage(hoverMessage.id)
    }
  }
  
  return (
    <div className="relative w-8 flex items-center justify-center">
      {/* 透明轨道 - 只用于事件处理 */}
      <div
        className="relative w-6 cursor-pointer transition-all duration-200"
        style={{ height: `${containerHeight - 40}px` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoverPosition(null)
          setHoverMessage(null)
        }}
        onClick={handleClick}
      >
        {/* 细线连接点 - 项目主题色 */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-border opacity-50 transform -translate-x-1/2" />
        
        {/* 纯色圆点 */}
        {timelineData.map((point) => {
          const message = messages.find(m => m.id === point.messageId)!
          const isActive = currentMessageId === point.messageId
          
          return (
            <div
              key={point.messageId}
              className={`absolute rounded-full cursor-pointer transform -translate-x-1/2 transition-all duration-300 ${
                getMessageColor(message, isActive)
              } ${
                isActive 
                  ? 'w-5 h-5 z-20 animate-pulse scale-110' 
                  : 'w-3 h-3 hover:w-4 hover:h-4 hover:z-10 hover:scale-110'
              }`}
              style={{
                top: `${point.percentage}%`,
                left: '50%'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onJumpToMessage(point.messageId)
              }}
            >
              {/* 激活状态的光环效果 */}
              {isActive && (
                <div className="absolute inset-0 rounded-full animate-ping bg-orange-400 opacity-50" />
              )}
            </div>
          )
        })}
        
        {/* 悬停提示 - 显示在左侧避免遮挡 */}
        {hoverPosition !== null && hoverMessage && (
          <div
            className="absolute right-6 bg-popover border border-border text-popover-foreground text-xs rounded-lg px-3 py-2 pointer-events-none z-20 shadow-lg"
            style={{
              top: `${hoverPosition}%`,
              transform: 'translateY(-50%)',
              maxWidth: '200px'
            }}
          >
            <div className="font-medium text-foreground">
              {new Date(hoverMessage.timestamp).toLocaleTimeString()}
            </div>
            <div className="text-muted-foreground mt-1 truncate">
              {hoverMessage.content.slice(0, 30)}...
            </div>
            
            {/* 箭头指针 - 指向圆点 */}
            <div 
              className="absolute top-1/2 -right-1 w-2 h-2 bg-popover border-r border-b border-border transform rotate-45 -translate-y-1/2"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// 消息组件
const MessageItem: React.FC<{
  message: TestMessage
  isActive?: boolean
}> = ({ message, isActive }) => {
  
  return (
    <div
      data-message-id={message.id}
      className={`mb-4 p-4 rounded-lg transition-all duration-300 ${
        isActive 
          ? 'bg-blue-50 border-2 border-blue-300 shadow-lg scale-[1.02]' 
          : 'bg-white border border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 头像 */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          message.role === 'user' 
            ? 'bg-blue-500 text-white' 
            : 'bg-green-500 text-white'
        }`}>
          {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        
        {/* 消息内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {message.role === 'user' ? '用户' : 'AI助手'}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.role === 'assistant' && (
              <Badge variant="secondary" className="text-xs text-green-600 bg-green-50">
                <Bot className="w-3 h-3" />
                <span className="ml-1">AI回复</span>
              </Badge>
            )}
          </div>
          
          {/* 内容 */}
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {message.content.includes('```') ? (
              <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                {message.content.replace(/```jsx?/g, '').replace(/```/g, '')}
              </div>
            ) : (
              message.content
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 主测试页面
export default function TestScrollbarPage() {
  const [messageCount, setMessageCount] = useState<number>(120)
  const [messages, setMessages] = useState<TestMessage[]>(() => generateTestMessages(120))
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 切换消息数量进行测试
  const handleChangeMessageCount = (count: number) => {
    setMessageCount(count)
    setMessages(generateTestMessages(count))
    setCurrentMessageId(null)
  }
  
  // 跳转到指定消息
  const jumpToMessage = useCallback((messageId: string) => {
    const element = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
      setCurrentMessageId(messageId)
      
      // 3秒后清除高亮
      setTimeout(() => {
        setCurrentMessageId(null)
      }, 3000)
    }
  }, [])
  
  // 使用 Intersection Observer 追踪当前可见消息
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const messageId = entry.target.getAttribute('data-message-id')
            if (messageId) {
              setCurrentMessageId(messageId)
            }
          }
        })
      },
      {
        root: containerRef.current,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0.3, 0.5, 0.7]
      }
    )

    const messageElements = containerRef.current.querySelectorAll('[data-message-id]')
    messageElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
  
  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="bg-card border-b border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/workspace">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回工作区
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">优化配色智能圆点导航测试</h1>
              <p className="text-sm text-muted-foreground">
                平衡配色 + 智能采样：蓝灰适度对比，橙色醒目高亮，保持视觉和谐的长对话导航
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              共 {messages.length} 条消息
            </div>
            
            {/* 测试按钮组 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">测试数量：</span>
              {[30, 60, 120, 200].map(count => (
                <Button 
                  key={count}
                  variant={messageCount === count ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleChangeMessageCount(count)}
                  className="text-xs"
                >
                  {count}条
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* 说明区域 */}
      <div className="max-w-6xl mx-auto p-4">
        <Card className="p-4 mb-4 bg-muted border">
          <h3 className="font-medium text-foreground mb-3">🎨 优化配色智能圆点导航</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="font-medium text-blue-800 mb-1">
                当前状态：{messages.length} 条消息
              </p>
              <p className="text-xs text-blue-600">
                {messages.length < 50 && '显示策略：全部圆点（< 50条）'}
                {messages.length >= 50 && messages.length <= 100 && '显示策略：每2条显示1个圆点（50-100条）'}
                {messages.length > 100 && `显示策略：智能采样约${Math.floor(messages.length / Math.max(1, Math.floor(messages.length / 20)))}条显示1个圆点（> 100条）`}
              </p>
            </div>
            
            <p>• <strong>平衡配色时间轴</strong>：适度对比 + 微妙阴影增强视觉层次</p>
            <div className="grid grid-cols-2 gap-6 mt-3">
              <div>
                <p className="font-medium mb-2 text-foreground">用户消息：</p>
                <p>● <span className="inline-block w-3 h-3 bg-gray-500 rounded-full mr-2 shadow-sm"></span>温和灰色圆点</p>
              </div>
              <div>
                <p className="font-medium mb-2 text-foreground">AI消息：</p>
                <p>● <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2 shadow-sm"></span>饱和蓝色圆点</p>
              </div>
            </div>
            <p>• <strong className="text-orange-500">橙色脉动</strong>：当前可见消息高亮显示</p>
            <p>• <strong>悬停效果</strong>：圆点放大+阴影，显示时间和内容预览</p>
            <p>• <strong>动态优化</strong>：长对话自动减少圆点密度，提升可用性</p>
          </div>
        </Card>
      </div>
      
      {/* 主内容区域 */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
          <div className="flex h-[600px]">
            {/* 消息列表 */}
            <div 
              ref={containerRef}
              className="flex-1 overflow-y-auto p-4 scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isActive={currentMessageId === message.id}
                />
              ))}
            </div>
            
            {/* 时间轴滚动条 */}
            <div className="bg-muted border-l border p-2">
              <TimelineScrollbar
                messages={messages}
                currentMessageId={currentMessageId}
                onJumpToMessage={jumpToMessage}
                containerHeight={600}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 底部统计 */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium mb-3">智能采样统计</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            {(() => {
              const totalMessages = messages.length
              const userMessages = messages.filter(m => m.role === 'user').length
              const aiMessages = messages.filter(m => m.role === 'assistant').length
              
              // 计算显示的圆点数量
              let displayedDots = 0
              if (totalMessages < 50) {
                displayedDots = totalMessages
              } else if (totalMessages <= 100) {
                displayedDots = Math.ceil(totalMessages / 2)
              } else {
                const step = Math.max(1, Math.floor(totalMessages / 20))
                displayedDots = Math.ceil(totalMessages / step)
              }
              
              return [
                { label: '总消息数', count: totalMessages, color: 'text-primary' },
                { label: '用户消息', count: userMessages, color: 'text-muted-foreground' },
                { label: 'AI回复', count: aiMessages, color: 'text-primary' },
                { label: '显示圆点', count: displayedDots, color: 'text-green-600' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))
            })()}
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              {(() => {
                const totalMessages = messages.length
                if (totalMessages === 0) return '压缩比：0% • 节省空间：0%'
                
                let displayedDots = 0
                if (totalMessages < 50) {
                  displayedDots = totalMessages
                } else if (totalMessages <= 100) {
                  displayedDots = Math.ceil(totalMessages / 2)
                } else {
                  const step = Math.max(1, Math.floor(totalMessages / 20))
                  displayedDots = Math.ceil(totalMessages / step)
                }
                
                const compressionRatio = Math.round((displayedDots / totalMessages) * 100)
                const spaceSaved = 100 - compressionRatio
                
                return `压缩比：${compressionRatio}% • 节省空间：${spaceSaved}%`
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}