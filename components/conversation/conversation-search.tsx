/**
 * 对话搜索框组件
 */

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface ConversationSearchProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function ConversationSearch({ value, onChange, className = '' }: ConversationSearchProps) {
  return (
    <div className={`sticky top-0 bg-card z-10 pb-2 mb-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索对话..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 h-9 bg-background"
        />
      </div>
    </div>
  )
}
