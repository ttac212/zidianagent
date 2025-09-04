# 对话功能自定义指南

## 1. 自定义消息样式

修改 `components/chat/message-item.tsx`：

```tsx
// 自定义消息气泡颜色
const messageStyles = cn(
  "rounded-2xl px-4 py-3",
  isUser
    ? "bg-blue-500 text-white"  // 用户消息样式
    : "bg-gray-100 text-black"   // AI消息样式
)
```

## 2. 添加新的快捷操作

在 `components/chat/chat-input.tsx` 中添加按钮：

```tsx
<Button onClick={() => onInputChange(`新的模板文本`)}>
  自定义操作
</Button>
```

## 3. 添加消息反馈功能

在 `hooks/use-chat-actions.ts` 中添加：

```tsx
const handleMessageFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
  // 保存反馈到本地或发送到服务器
  console.log('用户反馈:', messageId, feedback)
}
```

## 4. 自定义系统提示词

修改 `app/api/chat/route.ts`：

```tsx
const systemPrompt = {
  role: "system",
  content: "你是一个友好的AI助手，专注于帮助用户解决问题。"
}

const finalMessages = [systemPrompt, ...messages]
```

## 5. 添加语音输入

集成 Web Speech API：

```tsx
const startVoiceInput = () => {
  const recognition = new webkitSpeechRecognition()
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    setInput(transcript)
  }
  recognition.start()
}
```

## 6. 导出对话历史

添加导出功能：

```tsx
const exportChat = () => {
  const data = {
    messages: conversation.messages,
    exportedAt: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-history.json'
  a.click()
}
```

## 7. 集成更多 AI 模型

在 `.env.local` 中添加模型：

```env
MODEL_ALLOWLIST=gpt-4,claude-3,gemini-pro,llama-3
```

然后在 `lib/ai/models.ts` 中添加友好名称：

```tsx
const MODEL_NAME_MAP = {
  'gpt-4': 'GPT-4',
  'claude-3': 'Claude 3',
  'gemini-pro': 'Gemini Pro',
  'llama-3': 'Llama 3',
}
```

## 8. 添加对话分享功能

创建分享链接：

```tsx
const shareConversation = async () => {
  const shareUrl = `${window.location.origin}/shared/${conversation.id}`
  await navigator.clipboard.writeText(shareUrl)
  toast({ title: '链接已复制' })
}
```

## 9. 实现消息搜索

添加搜索功能：

```tsx
const searchMessages = (query: string) => {
  return messages.filter(msg => 
    msg.content.toLowerCase().includes(query.toLowerCase())
  )
}
```

## 10. 添加 Markdown 渲染

使用 react-markdown：

```bash
npm install react-markdown
```

```tsx
import ReactMarkdown from 'react-markdown'

<ReactMarkdown>{message.content}</ReactMarkdown>
```