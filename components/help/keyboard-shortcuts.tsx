"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Keyboard, Command } from "lucide-react"

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const shortcuts: Shortcut[] = [
  { keys: ["Ctrl", "K"], description: "打开命令面板", category: "通用" },
  { keys: ["Ctrl", "N"], description: "新建文档", category: "文档" },
  { keys: ["Ctrl", "S"], description: "保存文档", category: "文档" },
  { keys: ["Ctrl", "Enter"], description: "发送消息", category: "对话" },
  { keys: ["Ctrl", "L"], description: "清空对话", category: "对话" },
  { keys: ["Ctrl", "D"], description: "切换深色模式", category: "界面" },
  { keys: ["Ctrl", "?"], description: "显示快捷键帮助", category: "帮助" },
  { keys: ["Esc"], description: "关闭弹窗", category: "通用" },
  { keys: ["Tab"], description: "切换焦点", category: "导航" },
  { keys: ["Enter"], description: "确认操作", category: "通用" },
]

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "?") {
        event.preventDefault()
        setIsOpen(true)
      }
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)))

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Keyboard className="h-4 w-4" />
          快捷键
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            键盘快捷键
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="font-medium text-sm mb-3 text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((shortcut) => shortcut.category === category)
                  .map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <div key={keyIndex} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs font-mono px-2 py-1">
                              {key}
                            </Badge>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          按{" "}
          <Badge variant="outline" className="text-xs">
            Ctrl + ?
          </Badge>{" "}
          随时打开此帮助
        </div>
      </DialogContent>
    </Dialog>
  )
}
