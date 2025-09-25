/**
 * 对话搜索和过滤组件
 * Phase 1 实现：基础搜索 + 快速过滤
 */

"use client"

import React, { useState } from 'react'
import { Search, Filter, X, Clock, MessageSquare, Tag, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ConversationSearchProps {
  searchQuery: string
  onSearchChange: (_query: string) => void
  onClearSearch: () => void
  isSearching?: boolean
  resultCount?: number
  filters: {
    sortBy: string
    sortOrder: string
  }
  onFiltersChange: (_filters: any) => void
}

interface QuickFilter {
  key: string
  label: string
  icon: React.ReactNode
  count?: number
  active?: boolean
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isSearching = false,
  resultCount,
  filters,
  onFiltersChange
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // 快速过滤选项
  const quickFilters: QuickFilter[] = [
    {
      key: 'today',
      label: '今天',
      icon: <Clock className="w-3 h-3" />,
      count: 5
    },
    {
      key: 'week',
      label: '本周',
      icon: <Calendar className="w-3 h-3" />,
      count: 23
    },
    {
      key: 'long',
      label: '长对话',
      icon: <MessageSquare className="w-3 h-3" />,
      count: 12
    },
    {
      key: 'favorites',
      label: '收藏',
      icon: <Tag className="w-3 h-3" />,
      count: 8
    }
  ]

  return (
    <div className="space-y-3">
      {/* 搜索输入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="搜索对话标题或内容..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        {isSearching && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* 搜索结果统计 */}
      {searchQuery && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isSearching ? '搜索中...' : `找到 ${resultCount || 0} 个结果`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="text-xs"
          >
            清除搜索
          </Button>
        </div>
      )}

      {/* 快速过滤器 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">快速过滤:</span>
        {quickFilters.map((filter) => (
          <Badge
            key={filter.key}
            variant={filter.active ? "default" : "secondary"}
            className="cursor-pointer text-xs"
            onClick={() => {
              // 处理快速过滤逻辑
              // TODO: 实现快速过滤功能
            }}
          >
            {filter.icon}
            <span className="ml-1">{filter.label}</span>
            {filter.count && (
              <span className="ml-1 text-xs opacity-60">({filter.count})</span>
            )}
          </Badge>
        ))}
      </div>

      {/* 排序和高级过滤 */}
      <div className="flex items-center justify-between">
        {/* 排序选项 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">排序:</span>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">最近更新</SelectItem>
              <SelectItem value="alphabetical">按标题</SelectItem>
              <SelectItem value="messageCount">消息数量</SelectItem>
              <SelectItem value="relevance">相关性</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange({ 
              ...filters, 
              sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' 
            })}
            className="h-8 px-2 text-xs"
          >
            {filters.sortOrder === 'desc' ? '↓' : '↑'}
          </Button>
        </div>

        {/* 高级过滤触发器 */}
        <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              高级过滤
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <AdvancedFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              onClose={() => setShowAdvancedFilters(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

// 高级过滤面板组件
interface AdvancedFiltersProps {
  filters: any
  onFiltersChange: (_filters: any) => void
  onClose: () => void
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">高级过滤</h4>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* 时间范围 */}
      <div className="space-y-2">
        <label className="text-xs font-medium">时间范围</label>
        <Select>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="选择时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">今天</SelectItem>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="month">本月</SelectItem>
            <SelectItem value="quarter">本季度</SelectItem>
            <SelectItem value="year">今年</SelectItem>
            <SelectItem value="custom">自定义范围</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 模型过滤 */}
      <div className="space-y-2">
        <label className="text-xs font-medium">AI模型</label>
        <div className="flex flex-wrap gap-1">
          {['claude-opus', 'gemini-pro', 'gpt-4'].map((model) => (
            <Badge
              key={model}
              variant="secondary"
              className="cursor-pointer text-xs"
            >
              {model}
            </Badge>
          ))}
        </div>
      </div>

      {/* 消息数量 */}
      <div className="space-y-2">
        <label className="text-xs font-medium">消息数量</label>
        <div className="flex gap-2">
          <Input placeholder="最少" className="text-xs" />
          <span className="text-xs self-center">到</span>
          <Input placeholder="最多" className="text-xs" />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" className="flex-1 text-xs">
          应用过滤
        </Button>
        <Button variant="outline" size="sm" className="text-xs">
          重置
        </Button>
      </div>
    </div>
  )
}