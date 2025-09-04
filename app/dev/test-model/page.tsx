"use client"

import { useState } from "react"
import { ALLOWED_MODELS } from "@/lib/ai/models"

export default function TestModelPage() {
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const saved = localStorage.getItem('lastSelectedModelId')
      if (saved && ALLOWED_MODELS.find(m => m.id === saved)) return saved
    } catch {}
    return ALLOWED_MODELS[0]?.id || ''
  })
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testModel = async () => {
    setLoading(true)
    setResponse('')
    setLogs([])
    
    addLog(`开始测试，选择的模型: ${selectedModel}`)
    
    try {
      const requestBody = {
        messages: [
          { role: "user", content: "你是什么模型？请简短回答。" }
        ],
        model: selectedModel,
        temperature: 0.7,
      }
      
      addLog(`发送请求体: ${JSON.stringify(requestBody)}`)
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(requestBody)
      })
      
      addLog(`响应状态: ${res.status}`)
      
      if (!res.ok) {
        const error = await res.text()
        addLog(`错误响应: ${error}`)
        setResponse(`错误: ${error}`)
        return
      }
      
      const reader = res.body?.getReader()
      if (!reader) {
        addLog('无响应体')
        return
      }
      
      let fullContent = ''
      let receivedModel = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = new TextDecoder().decode(value)
        const lines = text.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              
              const parsed = JSON.parse(data)
              
              // 记录返回的模型信息（如果有）
              if (parsed.model && !receivedModel) {
                receivedModel = parsed.model
                addLog(`响应中的模型字段: ${receivedModel}`)
              }
              
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      setResponse(fullContent)
      addLog(`收到完整响应，长度: ${fullContent.length}`)
      
      // 检查响应内容
      if (fullContent.includes('Google')) {
        addLog('⚠️ 响应内容包含 "Google"，可能使用了 Gemini 模型')
      }
      if (fullContent.includes('Anthropic')) {
        addLog('✓ 响应内容包含 "Anthropic"，可能使用了 Claude 模型')
      }
      
    } catch (error) {
      addLog(`发生错误: ${error}`)
      setResponse(`错误: ${error}`)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">模型传递测试页面</h1>
      
      <div className="space-y-6">
        {/* 模型选择 */}
        <div className="p-4 border rounded-lg">
          <label className="block text-sm font-medium mb-2">选择模型:</label>
          <select 
            value={selectedModel}
            onChange={(e) => { const id = e.target.value; setSelectedModel(id); try { localStorage.setItem('lastSelectedModelId', id) } catch {} }}
            className="w-full p-2 border rounded"
          >
            {ALLOWED_MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.id})
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-gray-500">
            当前选择: {selectedModel}
          </div>
        </div>
        
        {/* 测试按钮 */}
        <button
          onClick={testModel}
          disabled={loading}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '测试中...' : '发送测试请求'}
        </button>
        
        {/* 日志 */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="text-sm font-medium mb-2">调试日志:</h3>
          <div className="space-y-1 text-xs font-mono">
            {logs.length === 0 ? (
              <div className="text-gray-400">等待测试...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={
                  log.includes('⚠️') ? 'text-orange-600' :
                  log.includes('✓') ? 'text-green-600' :
                  'text-gray-700'
                }>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* 响应 */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium mb-2">AI 响应:</h3>
          <div className="whitespace-pre-wrap text-sm">
            {response || <span className="text-gray-400">等待响应...</span>}
          </div>
        </div>
        
        {/* 期望结果 */}
        <div className="p-4 border rounded-lg bg-blue-50">
          <h3 className="text-sm font-medium mb-2">期望结果:</h3>
          <ul className="text-sm space-y-1">
            <li>• 选择 Claude 模型 → 应该回答 "Anthropic"</li>
            <li>• 选择 Gemini 模型 → 应该回答 "Google"</li>
          </ul>
        </div>
      </div>
    </div>
  )
}