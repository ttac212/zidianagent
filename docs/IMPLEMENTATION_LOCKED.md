# 智点AI平台 - 功能实现锁定文档

**重要说明**: 本文档记录项目中所有已实现功能的核心代码和架构设计。这些实现已经过完整测试，后续开发中**不得修改**这些核心实现，只能进行性能优化和新功能扩展。

## 目录
1. [聊天系统核心实现](#1-聊天系统核心实现)
2. [用户认证与会话管理](#2-用户认证与会话管理)
3. [使用量统计系统](#3-使用量统计系统)
4. [多KEY架构实现](#4-多key架构实现)
5. [商家数据系统](#5-商家数据系统)
6. [视频内容洞察](#6-视频内容洞察)
7. [数据库设计](#7-数据库设计)
8. [关键工具函数](#8-关键工具函数)

---

## 1. 聊天系统核心实现

### 1.1 主聊天组件架构
**位置**: `components/chat/smart-chat-center-v2-fixed.tsx`

```typescript
// 核心组件结构 - 不可修改
export const SmartChatCenterV2Fixed = React.memo<SmartChatCenterProps>(({
  conversation,
  conversations = [],
  selectedModel,
  selectedText,
  editorContextEnabled = false,
  editorContent,
  onUpdateConversation,
  onCreateConversation,
  onDeleteConversation,
  onSelectConversation,
  onSelectedModelChange,
}) => {
  // 1. 统一模型状态管理
  const {
    selectedModel: currentModel,
    setSelectedModel,
    getCurrentModel,
    isInitialized: modelInitialized,
    validateModel
  } = useModelState(selectedModel)

  // 2. 初始化设置
  const initialSettings = useMemo(() => ({
    ...DEFAULT_CHAT_SETTINGS,
    modelId: currentModel,
    contextAware: !!editorContextEnabled,
  }), [currentModel, editorContextEnabled])

  // 3. 状态管理 - 使用 useReducer
  const { state, dispatch } = useChatState({
    settings: initialSettings,
    messages: [], // 避免循环依赖
  })

  // 4. 操作管理 - 纯 fetch 实现
  const {
    sendMessage,
    stopGeneration,
    copyMessage,
    retryMessage,
    updateSettings,
    handleTemplateInject,
  } = useChatActions({
    state,
    dispatch,
    conversation,
    onUpdateConversation,
    getCurrentModel,
    onCreateConversation,
    onSelectConversation,
  })

  // 5. 副作用管理
  const {
    scrollToBottom,
    focusInput,
    scrollAreaRef,
    textareaRef,
  } = useChatEffects({
    state,
    dispatch,
    onSendMessage: sendMessage,
    onStopGeneration: stopGeneration,
    onCreateConversation,
  })
})
```

### 1.2 聊天状态管理
**位置**: `hooks/use-chat-state.ts`

```typescript
// ChatState Reducer - 核心状态管理逻辑
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload],
        error: null
      }
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.id === action.payload.id 
            ? { ...msg, ...action.payload.updates }
            : msg
        )
      }
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload }
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }
    case 'SET_SETTINGS':
      return { 
        ...state, 
        settings: { ...state.settings, ...action.payload }
      }
    case 'RESET_STATE':
      return { ...DEFAULT_CHAT_STATE }
    default:
      return state
  }
}

// 状态选择器 - 性能优化
export const messageSelectors = {
  getLastMessage: (state: ChatState): ChatMessage | null => 
    state.messages.length > 0 ? state.messages[state.messages.length - 1] : null,
  getUserMessageCount: (state: ChatState): number =>
    state.messages.filter(msg => msg.role === 'user').length,
  getAssistantMessageCount: (state: ChatState): number =>
    state.messages.filter(msg => msg.role === 'assistant').length,
  getTotalTokens: (state: ChatState): number =>
    state.messages.reduce((total, msg) => total + (msg.tokens || 0), 0),
}
```

### 1.3 聊天操作逻辑
**位置**: `hooks/use-chat-actions-fixed.ts`

```typescript
// 发送消息核心逻辑 - 纯 fetch 实现，避免 AI SDK 循环依赖
const sendMessage = useCallback(async (content: string) => {
  if (!content.trim() || state.isLoading) return

  // 1. 自动创建对话（如果需要）
  let currentConversation: Conversation | undefined = conversation
  if (!currentConversation && onCreateConversation) {
    const modelForNewConversation = getSendingModel()
    const newConversation = await onCreateConversation(modelForNewConversation)
    if (!newConversation) {
      dispatch({ type: 'SET_ERROR', payload: '创建对话失败' })
      return
    }
    currentConversation = newConversation
    if (onSelectConversation) {
      onSelectConversation(currentConversation.id)
    }
  }

  // 2. 创建用户消息
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: content.trim(),
    timestamp: Date.now(),
  }

  // 3. 发送到 API（SSE 流式响应处理）
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [...state.messages, userMessage],
      model: getSendingModel(),
      temperature: state.settings.temperature,
      conversationId: currentConversation?.id,
    }),
    signal: abortControllerRef.current?.signal,
  })

  // 4. 处理 SSE 流
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const chunk = decoder.decode(value)
    const lines = chunk.split('\\n')
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          // 流结束
        } else {
          const parsed = JSON.parse(data)
          // 更新助手消息
          dispatch({
            type: 'UPDATE_MESSAGE',
            payload: {
              id: assistantMessageId,
              updates: {
                content: currentContent + parsed.choices[0].delta.content,
              },
            },
          })
        }
      }
    }
  }
}, [state, dispatch, conversation, onCreateConversation, onSelectConversation])
```

### 1.4 聊天 API 路由
**位置**: `app/api/chat/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. 认证检查
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return new Response(JSON.stringify({ error: "未认证" }), { status: 401 })
  }
  const userId = String(token.sub)

  // 2. 解析请求
  const { messages, model, temperature, conversationId } = await request.json()

  // 3. 模型验证
  const modelValidation = validateModelId(model)
  if (!modelValidation.isValid) {
    return new Response(
      JSON.stringify({ error: `模型验证失败: ${modelValidation.errors.join(', ')}` }),
      { status: 400 }
    )
  }

  // 4. 自动创建对话（如果需要）
  if (userId && !conversationId) {
    const created = await prisma.conversation.create({
      data: {
        userId,
        modelId: model,
        temperature: temperature || 0.7,
        lastMessageAt: new Date()继续
      },
    })
    conversationId = created.id
  }

  // 5. 保存用户消息
  if (userId && conversationId && messages.length > 0) {
    const latestMessage = messages[messages.length - 1]
    if (latestMessage.role === 'user') {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'USER',
          content: latestMessage.content,
          modelId: model,
          temperature: temperature || null,
        }
      })
    }
  }

  // 6. 多KEY选择
  const keySelection = selectApiKey(model)
  if (!keySelection.apiKey) {
    return new Response(JSON.stringify({ error: `未配置模型 ${model} 对应的API Key` }), { status: 500 })
  }

  // 7. 转发到 302.AI
  const base = process.env.LLM_API_BASE || "https://api.302.ai/v1"
  const upstream = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${keySelection.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature,
    }),
  })

  // 8. 创建转换流拦截响应
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk)
      const lines = text.split('\\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data !== '[DONE]') {
            const parsed = JSON.parse(data)
            // 收集内容和 token 使用量
            if (parsed.choices?.[0]?.delta?.content) {
              assistantContent += parsed.choices[0].delta.content
            }
            if (parsed.usage) {
              tokenUsage = parsed.usage
            }
          }
        }
      }
      controller.enqueue(chunk)
    },
    flush() {
      // 异步保存助手消息和更新统计
      if (userId && assistantContent) {
        saveAssistantMessage()
      }
    }
  })

  // 9. 异步保存函数（核心统计逻辑）
  async function saveAssistantMessage() {
    // 保存 AI 响应
    if (conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: assistantContent,
          modelId: model,
          temperature,
          promptTokens: tokenUsage.prompt_tokens || 0,
          completionTokens: tokenUsage.completion_tokens || 0,
          totalTokens: tokenUsage.total_tokens || 0,
        }
      })
    }

    // 更新用户用量
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentMonthUsage: { increment: tokenUsage.total_tokens || 0 },
        totalTokenUsed: { increment: tokenUsage.total_tokens || 0 },
        lastActiveAt: new Date(),
      }
    })

    // 更新使用量统计（双重记录）
    const today = getTodayDate()
    
    // 总量统计（modelId="_total" 标识总量）
    await prisma.usageStats.upsert({
      where: { userId_date_modelId: { userId, date: today, modelId: "_total" } },
      update: {
        apiCalls: { increment: 1 },
        successfulCalls: { increment: 1 },
        totalTokens: { increment: tokenUsage.total_tokens || 0 },
        promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
        completionTokens: { increment: tokenUsage.completion_tokens || 0 },
      },
      create: {
        userId,
        date: today,
        modelId: "_total",
        apiCalls: 1,
        successfulCalls: 1,
        totalTokens: tokenUsage.total_tokens || 0,
        promptTokens: tokenUsage.prompt_tokens || 0,
        completionTokens: tokenUsage.completion_tokens || 0,
      }
    })
    
    // 按模型统计
    await prisma.usageStats.upsert({
      where: { userId_date_modelId: { userId, date: today, modelId: model } },
      update: {
        apiCalls: { increment: 1 },
        successfulCalls: { increment: 1 },
        totalTokens: { increment: tokenUsage.total_tokens || 0 },
        promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
        completionTokens: { increment: tokenUsage.completion_tokens || 0 },
      },
      create: {
        userId,
        date: today,
        modelId: model,
        modelProvider: getModelProvider(model),
        apiCalls: 1,
        successfulCalls: 1,
        totalTokens: tokenUsage.total_tokens || 0,
        promptTokens: tokenUsage.prompt_tokens || 0,
        completionTokens: tokenUsage.completion_tokens || 0,
      }
    })
  }

  return new Response(upstream.body.pipeThrough(transformStream), { status: 200, headers })
}
```

---

## 2. 用户认证与会话管理

### 2.1 NextAuth 配置
**位置**: `auth.ts`

```typescript
// NextAuth 核心配置 - 不可修改
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  debug: false, // 关闭调试避免客户端错误
  
  providers: [
    Credentials({
      name: "Development Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "password" },
      },
      async authorize(credentials) {
        // 1. 检查开发登录码
        const devCode = process.env.DEV_LOGIN_CODE
        if (!devCode) return null
        
        // 2. 验证凭据
        if (!credentials?.email || !credentials?.code) return null
        if (credentials.code !== devCode) return null

        // 3. 查找用户
        const user = await prisma.user.findUnique({ 
          where: { email: credentials.email } 
        })
        if (!user) return null
        
        // 4. 检查用户状态
        if (user.status !== "ACTIVE") return null
        
        // 5. 返回用户信息
        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.username ?? undefined,
          role: user.role,
          displayName: user.displayName ?? null,
          currentMonthUsage: user.currentMonthUsage,
          monthlyTokenLimit: user.monthlyTokenLimit,
        }
      },
    }),
  ],
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.displayName = user.displayName
        token.currentMonthUsage = user.currentMonthUsage
        token.monthlyTokenLimit = user.monthlyTokenLimit
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.displayName = token.displayName
        session.user.currentMonthUsage = token.currentMonthUsage
        session.user.monthlyTokenLimit = token.monthlyTokenLimit
      }
      return session
    },
  },
}
```

### 2.2 中间件认证保护
**位置**: `middleware.ts`

```typescript
// 优化的认证中间件 - 包含缓存系统
const tokenCache = new Map<string, TokenCacheEntry>()

// 路径匹配优化
const PUBLIC_PATHS = new Set([
  '/', '/login', '/api/auth', '/api/invite-codes'
])

const PROTECTED_PATHS = new Set([
  '/workspace', '/settings', '/admin', '/merchants', 
  '/documents', '/feedback', '/help', '/inspiration'
])

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // 1. 公开路径直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }
  
  // 2. 需要认证的路径
  if (needsAuth(pathname)) {
    const sessionToken = getSessionToken(req)
    
    if (!sessionToken) {
      return redirectToLogin(req)
    }
    
    // 3. 检查缓存（5分钟有效期）
    const cached = tokenCache.get(sessionToken)
    if (cached && cached.expires > Date.now()) {
      if (!cached.valid) {
        return redirectToLogin(req)
      }
      
      // 4. 管理员路径额外检查
      if (isAdminPath(pathname) && cached.role !== 'ADMIN') {
        return new NextResponse('Forbidden', { status: 403 })
      }
      
      // 5. API请求添加用户ID到headers
      if (pathname.startsWith('/api/') && cached.userId) {
        const response = NextResponse.next()
        response.headers.set('x-user-id', cached.userId)
        return response
      }
      
      return NextResponse.next()
    }
    
    // 6. 缓存未命中，验证token
    const token = await getToken({ req })
    const valid = !!token?.sub
    
    // 7. 缓存结果
    tokenCache.set(sessionToken, {
      valid,
      userId: token?.sub as string,
      role: token?.role as string,
      expires: Date.now() + 5 * 60 * 1000
    })
    
    if (!valid) {
      return redirectToLogin(req)
    }
    
    return NextResponse.next()
  }
  
  return NextResponse.next()
}
```

### 2.3 邀请码系统
**位置**: `components/auth/invite-code-auth.tsx`

```typescript
// 邀请码验证组件
export function InviteCodeAuth({ onSuccess }: InviteCodeAuthProps) {
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 1. 验证邀请码
      const validateRes = await fetch('/api/invite-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
      })

      if (!validateRes.ok) {
        throw new Error('邀请码无效')
      }

      // 2. 注册用户
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          inviteCode,
        }),
      })

      if (!registerRes.ok) {
        throw new Error('注册失败')
      }

      const { user } = await registerRes.json()
      
      // 3. 自动登录
      const result = await signIn('credentials', {
        email: user.email,
        code: process.env.NEXT_PUBLIC_DEV_LOGIN_CODE,
        redirect: false,
      })

      if (result?.ok) {
        onSuccess(user)
      }
    } catch (error) {
      toast({
        title: "注册失败",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }
}
```

### 2.4 会话管理
**位置**: `prisma/schema.prisma`

```prisma
// NextAuth 会话模型
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

// 用户会话追踪
model UserSession {
  id         String   @id @default(cuid())
  userId     String
  userAgent  String?
  ip         String?
  lastActive DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, lastActive])
  @@map("user_sessions")
}
```

---

## 3. 使用量统计系统

### 3.1 统计数据模型
**位置**: `prisma/schema.prisma`

```prisma
model UsageStats {
  id               String   @id @default(cuid())
  userId           String
  date             DateTime // UTC归零的日期
  modelId          String?  // 可选，null或"_total" 表示总量统计
  modelProvider    String?  // Claude/Google/OpenAI等
  
  // API调用统计
  apiCalls         Int      @default(0)
  successfulCalls  Int      @default(0)
  failedCalls      Int      @default(0)
  
  // Token使用统计
  totalTokens      Int      @default(0)
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  
  // 消息统计
  messagesCreated  Int      @default(0)
  
  // 时间戳
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // 关联
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // 唯一约束：用户+日期+模型
  @@unique([userId, date, modelId])  // modelId可为null用于总量统计
  @@index([userId, date])
  @@index([modelId])
  @@map("usage_stats")
}
```

### 3.2 统计记录逻辑
**位置**: `app/api/chat/route.ts` 中的 `saveAssistantMessage` 函数

```typescript
async function saveAssistantMessage() {
  const today = getTodayDate() // UTC归零日期
  
  // 1. 保存AI响应消息
  if (conversationId) {
    await prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: assistantContent,
        modelId: model,
        temperature,
        promptTokens: tokenUsage.prompt_tokens || 0,
        completionTokens: tokenUsage.completion_tokens || 0,
        totalTokens: tokenUsage.total_tokens || 0,
      }
    })
  }

  // 2. 更新用户总使用量
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentMonthUsage: { increment: tokenUsage.total_tokens || 0 },
      totalTokenUsed: { increment: tokenUsage.total_tokens || 0 },
      lastActiveAt: new Date(),
    }
  })

  // 3. 更新总量统计（modelId="_total"）
  await prisma.usageStats.upsert({
    where: { 
      userId_date_modelId: { 
        userId, 
        date: today, 
        modelId: "_total" 
      } 
    },
    update: {
      apiCalls: { increment: 1 },
      successfulCalls: { increment: 1 },
      totalTokens: { increment: tokenUsage.total_tokens || 0 },
      promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
      completionTokens: { increment: tokenUsage.completion_tokens || 0 },
      messagesCreated: { increment: 2 }, // 用户消息+AI消息
    },
    create: {
      userId,
      date: today,
      modelId: "_total",
      apiCalls: 1,
      successfulCalls: 1,
      totalTokens: tokenUsage.total_tokens || 0,
      promptTokens: tokenUsage.prompt_tokens || 0,
      completionTokens: tokenUsage.completion_tokens || 0,
      messagesCreated: 2,
    }
  })
  
  // 4. 更新按模型统计
  const modelProvider = getModelProvider(model)
  await prisma.usageStats.upsert({
    where: { 
      userId_date_modelId: { 
        userId, 
        date: today, 
        modelId: model 
      } 
    },
    update: {
      apiCalls: { increment: 1 },
      successfulCalls: { increment: 1 },
      totalTokens: { increment: tokenUsage.total_tokens || 0 },
      promptTokens: { increment: tokenUsage.prompt_tokens || 0 },
      completionTokens: { increment: tokenUsage.completion_tokens || 0 },
      messagesCreated: { increment: 2 },
    },
    create: {
      userId,
      date: today,
      modelId: model,
      modelProvider,
      apiCalls: 1,
      successfulCalls: 1,
      totalTokens: tokenUsage.total_tokens || 0,
      promptTokens: tokenUsage.prompt_tokens || 0,
      completionTokens: tokenUsage.completion_tokens || 0,
      messagesCreated: 2,
    }
  })
}
```

### 3.3 统计辅助函数
**位置**: `lib/ai/model-stats-helper.ts`

```typescript
// 获取模型提供商
export function getModelProvider(modelId: string): string {
  if (!modelId) return 'Unknown'
  const modelLower = modelId.toLowerCase()
  
  if (modelLower.includes('claude')) return 'Claude'
  if (modelLower.includes('gemini')) return 'Google'
  if (modelLower.includes('gpt')) return 'OpenAI'
  
  return 'Unknown'
}

// 创建统一的今日日期对象（UTC归零）
export function getTodayDate(): Date {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

// 格式化统计数字显示
export function formatStatsNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
```

---

## 4. 多KEY架构实现

### 4.1 Key管理器核心逻辑
**位置**: `lib/ai/key-manager.ts`

```typescript
// API Key配置映射 - 不可修改
const KEY_CONFIGS: KeyConfig[] = [
  {
    key: process.env.LLM_CLAUDE_API_KEY || '',
    provider: 'Claude',
    models: ['claude-opus-4-1-20250805', 'claude-3-5-sonnet', 'claude-3-opus']
  },
  {
    key: process.env.LLM_GEMINI_API_KEY || '',
    provider: 'Google',
    models: ['gemini-2.5-pro', 'gemini-1.5-pro']
  },
  {
    key: process.env.LLM_OPENAI_API_KEY || '',
    provider: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  }
]

// 回退API Key（兼容旧配置）
const FALLBACK_KEY = process.env.LLM_API_KEY || ''

// 根据模型ID选择最合适的API Key
export function selectApiKey(modelId: string): KeySelectionResult {
  // 1. 精确匹配：在配置中查找支持该模型的专属key
  for (const config of KEY_CONFIGS) {
    if (config.key && config.models.includes(modelId)) {
      return {
        apiKey: config.key,
        provider: config.provider,
        keySource: 'specific',
        confidence: 'high'
      }
    }
  }

  // 2. 模糊匹配：根据模型名称推断供应商
  const modelLower = modelId.toLowerCase()
  for (const config of KEY_CONFIGS) {
    if (!config.key) continue

    const providerMatches = [
      { provider: 'Claude', patterns: ['claude'] },
      { provider: 'Google', patterns: ['gemini', 'palm', 'bard'] },
      { provider: 'OpenAI', patterns: ['gpt', 'text-davinci', 'text-ada'] }
    ]

    const match = providerMatches.find(pm => 
      pm.provider === config.provider && 
      pm.patterns.some(pattern => modelLower.includes(pattern))
    )

    if (match) {
      return {
        apiKey: config.key,
        provider: config.provider,
        keySource: 'specific',
        confidence: 'medium'
      }
    }
  }

  // 3. 回退到统一KEY（保持兼容性）
  if (FALLBACK_KEY) {
    return {
      apiKey: FALLBACK_KEY,
      provider: 'Unknown',
      keySource: 'fallback',
      confidence: 'low'
    }
  }

  // 4. 无可用Key - 抛出错误
  throw new Error(`无法为模型 ${modelId} 找到有效的API Key`)
}
```

### 4.2 模型白名单机制
**位置**: `lib/ai/models.ts`

```typescript
// 模型白名单来自环境变量，支持动态配置
const raw = (process.env.MODEL_ALLOWLIST || '').trim()
const DEFAULT_ALLOWLIST = [
  'claude-opus-4-1-20250805',
  'gemini-2.5-pro',
]

const allowlist = raw
  ? raw.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ALLOWLIST

// 模型友好名称映射
const MODEL_NAME_MAP: Record<string, string> = {
  'claude-opus-4-1-20250805': 'Claude Opus 4.1',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
}

// 导出格式化的模型列表（前端使用）
export const ALLOWED_MODELS = allowlist.map(id => ({
  id,
  name: MODEL_NAME_MAP[id] || id
}))

// 导出简单数组（后端验证使用）
export const ALLOWED_MODEL_IDS = allowlist

// 默认模型为白名单首项
export const DEFAULT_MODEL = ALLOWED_MODEL_IDS[0]

export function isAllowed(model?: string) {
  if (!model) return false
  return ALLOWED_MODEL_IDS.includes(model)
}
```

### 4.3 模型验证器
**位置**: `lib/model-validator.ts`

```typescript
// 模型验证结果接口
interface ModelValidationResult {
  isValid: boolean
  modelId?: string
  modelInfo?: ModelInfo
  errors: string[]
  warnings: string[]
}

// 验证模型ID
export function validateModelId(modelId: string): ModelValidationResult {
  const result: ModelValidationResult = {
    isValid: false,
    errors: [],
    warnings: []
  }

  // 1. 检查模型ID是否为空
  if (!modelId) {
    result.errors.push('模型ID不能为空')
    return result
  }

  // 2. 检查是否在白名单中
  if (!isAllowed(modelId)) {
    result.errors.push(`模型 ${modelId} 不在允许列表中`)
    result.warnings.push(`允许的模型: ${ALLOWED_MODEL_IDS.join(', ')}`)
    return result
  }

  // 3. 获取模型信息
  const modelInfo = ALLOWED_MODELS.find(m => m.id === modelId)
  if (modelInfo) {
    result.isValid = true
    result.modelId = modelId
    result.modelInfo = {
      id: modelInfo.id,
      name: modelInfo.name,
      provider: getModelProvider(modelInfo.id)
    }
  }

  return result
}

// 创建模型验证中间件
export function createModelValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const modelId = req.body?.model || req.query?.model
    const validation = validateModelId(modelId)
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: '模型验证失败',
        details: validation.errors,
        suggestions: validation.warnings
      })
    }
    
    req.validatedModel = validation.modelInfo
    next()
  }
}
```

---

## 5. 数据库设计

### 5.1 核心数据模型
**位置**: `prisma/schema.prisma`

```prisma
// 用户表 - 系统核心
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  emailVerified DateTime?
  username    String?  @unique
  displayName String?
  avatar      String?
  role        UserRole @default(USER)
  status      UserStatus @default(ACTIVE)

  // 用量配额
  monthlyTokenLimit    Int @default(100000)
  currentMonthUsage    Int @default(0)
  totalTokenUsed       Int @default(0)

  // 邀请码信息
  inviteCodeId String?
  inviteCode   InviteCode? @relation("InviteCodeUsage", fields: [inviteCodeId], references: [id])

  // 时间戳
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lastActiveAt DateTime?

  // 关联关系
  accounts         Account[]
  sessions         Session[]
  conversations    Conversation[]
  documents        Document[]
  feedbacks        Feedback[]
  usageStats       UsageStats[]
  userSessions     UserSession[]

  @@map("users")
}

// 对话表 - 聊天核心
model Conversation {
  id          String   @id @default(cuid())
  title       String   @default("新对话")
  userId      String
  
  // 对话配置
  modelId     String   // 根据 MODEL_ALLOWLIST 环境变量动态决定默认值
  temperature Float    @default(0.7)
  maxTokens   Int      @default(2000)
  contextAware Boolean @default(true)
  
  // 统计信息
  messageCount Int     @default(0)
  totalTokens  Int     @default(0)
  
  // 时间戳
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  lastMessageAt DateTime?
  
  // 关联
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages     Message[]
  
  @@index([userId, lastMessageAt])
  @@map("conversations")
}

// 消息表 - 对话内容
model Message {
  id          String   @id @default(cuid())
  conversationId String
  role        MessageRole
  content     String   @db.Text
  
  // AI相关
  modelId     String?
  temperature Float?
  
  // Token统计
  promptTokens     Int?
  completionTokens Int?
  totalTokens      Int?
  
  // 响应信息
  finishReason String?
  
  // 时间戳
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关联
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  @@index([conversationId, createdAt])
  @@map("messages")
}

// 邀请码表 - 注册管理
model InviteCode {
  id          String   @id @default(cuid())
  code        String   @unique
  description String?
  
  // 使用限制
  maxUses     Int      @default(1)
  usedCount   Int      @default(0)
  isActive    Boolean  @default(true)
  
  // 有效期
  expiresAt   DateTime?
  
  // 关联的用户权限
  defaultRole        UserRole @default(USER)
  monthlyTokenLimit  Int      @default(50000)
  
  // 创建信息
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 使用记录
  usedBy      User[]   @relation("InviteCodeUsage")
  
  @@index([code])
  @@index([isActive, expiresAt])
  @@map("invite_codes")
}
```

### 5.2 枚举定义
**位置**: `prisma/schema.prisma`

```prisma
// 用户角色
enum UserRole {
  ADMIN
  USER
  GUEST
}

// 用户状态
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  DELETED
}

// 消息角色
enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
  FUNCTION
}

// 反馈状态
enum FeedbackStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
  REJECTED
}

// 文档类型
enum DocumentType {
  TEXT
  MARKDOWN
  PDF
  IMAGE
  VIDEO
  AUDIO
  OTHER
}

// 商家内容类型
enum MerchantContentType {
  VIDEO
  ARTICLE
  ACTIVITY
  PRODUCT
  SERVICE
  OTHER
}
```

---

## 6. 商家数据系统（简要）

### 6.1 商家数据模型
```prisma
model Merchant {
  id              String   @id @default(cuid())
  name            String
  category        String
  rating          Float?
  reviewCount     Int      @default(0)
  priceRange      String?
  address         String?
  phone           String?
  businessHours   Json?
  tags            String[]
  description     String?  @db.Text
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  contents        MerchantContent[]
  
  @@map("merchants")
}
```

---

## 7. 视频内容洞察（简要）

### 7.1 数据读取逻辑
**位置**: `app/api/keyword-data/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || '家常菜'
  
  // 读取聚合数据文件
  const dataPath = path.join(
    process.cwd(), 
    'keyword_search_aggregated',
    `${keyword}_aggregated.json`
  )
  
  const data = await fs.readFile(dataPath, 'utf-8')
  return Response.json(JSON.parse(data))
}
```

---

## 8. 关键工具函数

### 8.1 标题生成
**位置**: `lib/title-utils.ts`

```typescript
export function shouldGenerateTitle(messages: ChatMessage[]): boolean {
  const userMessages = messages.filter(m => m.role === 'user')
  return userMessages.length === 1
}

export async function generateConversationTitle(
  firstMessage: string,
  modelId: string
): Promise<string> {
  // 使用AI生成标题的逻辑
  const prompt = `为以下对话生成一个简短的标题（不超过20个字）：\n\n${firstMessage}`
  // ... AI调用逻辑
  return generatedTitle || firstMessage.slice(0, 30)
}
```

---

## 总结

本文档记录了智点AI平台的核心功能实现，已经过全面校验和更新，包括：

1. **聊天系统**：基于useReducer的状态管理，纯fetch实现的API调用，SSE流式响应处理
2. **认证系统**：NextAuth JWT策略，中间件token缓存，邀请码注册机制
3. **统计系统**：双重记录机制（总量"_total"+按模型），UTC归零日期统一处理，modelId可为null兼容历史数据
4. **多KEY架构**：智能Key选择，模型白名单验证，供应商自动识别
5. **数据库设计**：Prisma ORM，CUID主键，完善的关联关系

这些实现已经过完整测试和验证，作为项目的核心基础，后续开发只在此基础上进行性能优化和新功能扩展，不得修改核心实现逻辑。