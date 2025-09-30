"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useStorage } from "@/components/providers/storage-provider"
import { Download, Upload, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "@/lib/toast/toast"
import * as dt from '@/lib/utils/date-toolkit'

export function DataManagement() {
  const [importData, setImportData] = useState("")
  const { clearAllData, exportData, importData: importDataFn } = useStorage()
  // 使用统一的toast API

  const handleExport = () => {
    const data = exportData()
    if (data) {
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `zhidian-backup-${dt.toISO().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("导出成功", {
        description: "数据已导出到文件"
      })
    }
  }

  const handleImport = () => {
    if (!importData.trim()) {
      toast.error("导入失败", {
        description: "请输入要导入的数据"
      })
      return
    }

    const success = importDataFn(importData)
    if (success) {
      toast.success("导入成功", {
        description: "数据已导入，页面将刷新"
      })
      setTimeout(() => window.location.reload(), 1000)
    } else {
      toast.error("导入失败", {
        description: "数据格式不正确"
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            数据导出
          </CardTitle>
          <CardDescription>导出您的对话记录、设置和文档数据</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            导出数据
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            数据导入
          </CardTitle>
          <CardDescription>从备份文件恢复您的数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="粘贴导出的JSON数据..."
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
          <Button onClick={handleImport} disabled={!importData.trim()} className="gap-2">
            <Upload className="h-4 w-4" />
            导入数据
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            危险操作
          </CardTitle>
          <CardDescription>清空所有本地数据，此操作不可恢复</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={clearAllData} variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" />
            清空所有数据
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
