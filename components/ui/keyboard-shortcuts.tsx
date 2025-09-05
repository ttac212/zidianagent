"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, TrendingUp, FileText, Keyboard } from "lucide-react"

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  const shortcuts = [
    {
      category: "导航",
      items: [
        { keys: ["Ctrl", "1"], description: "打开对话页面", icon: MessageSquare },
        { keys: ["Ctrl", "2"], description: "打开热门数据", icon: TrendingUp },
        { keys: ["Ctrl", "3"], description: "打开文档管理", icon: FileText },
        { keys: ["Ctrl", "K"], description: "显示快捷键", icon: Keyboard },
      ],
    },
    {
      category: "对话功能",
      items: [
        { keys: ["Enter"], description: "发送消息" },
        { keys: ["Shift", "Enter"], description: "换行" },
        { keys: ["Ctrl", "N"], description: "新建对话" },
        { keys: ["Ctrl", "/"], description: "搜索对话" },
      ],
    },
    {
      category: "编辑功能",
      items: [
        { keys: ["Ctrl", "S"], description: "保存文档" },
        { keys: ["Ctrl", "Z"], description: "撤销" },
        { keys: ["Ctrl", "Y"], description: "重做" },
        { keys: ["Ctrl", "F"], description: "查找" },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            键盘快捷键
          </DialogTitle>
          <DialogDescription>使用这些快捷键提高您的工作效率</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="font-medium text-sm text-muted-foreground mb-3">{category.category}</h3>
              <div className="space-y-2">
                {category.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      {"icon" in item && item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">{item.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <div key={keyIndex} className="flex items-center gap-1">
                          <Badge variant="outline" className="px-2 py-1 text-xs font-mono">
                            {key}
                          </Badge>
                          {keyIndex < item.keys.length - 1 && <span className="text-xs text-muted-foreground">+</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {category.category !== shortcuts[shortcuts.length - 1].category && <Separator className="mt-4" />}
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          按{" "}
          <Badge variant="outline" className="px-1 py-0.5 text-xs">
            Esc
          </Badge>{" "}
          关闭此对话框
        </div>
      </DialogContent>
    </Dialog>
  )
}
