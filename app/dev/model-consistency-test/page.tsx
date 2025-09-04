"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/ai/models"
import { DEFAULT_CHAT_SETTINGS, type ChatSettings } from "@/types/chat"
import { useChatState } from "@/hooks/use-chat-state"
import { useChatActionsFixed } from "@/hooks/use-chat-actions-fixed"
import { ModelSelectorAnimated } from "@/components/chat/model-selector-animated"

// 仅测试用途的开发页面：/dev-model-consistency-test
// 目标：在不改动生产代码的前提下，系统性诊断“UI选择Gemini但请求使用Claude”的一致性问题。

type RequestLog = {
  id: number
  when: string
  uiSelected: string
  reducerModelId: string
  requestBodyModel?: string
  resultStatus: number
  note?: string
}

function useMockChatFetch(
  options: {
    failFirstRequest: boolean
    simulateSlowMs: number
  },
  getSnapshot: () => { uiSelected: string; reducerModelId: string }
) {
  const firstFailedRef = useRef(false)
  const originalFetchRef = useRef<typeof fetch | null>(null)
  const nextReqIdRef = useRef(1)

  const [logs, setLogs] = useState<RequestLog[]>([])

  const install = useCallback(() => {
    if (typeof window === "undefined") return () => {}
    if (originalFetchRef.current) return () => {}

    originalFetchRef.current = window.fetch.bind(window)

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      const isChat = url.includes("/api/chat") && (init?.method || "GET").toUpperCase() === "POST"

      if (!isChat) {
        return originalFetchRef.current!(input as any, init)
      }

      // 读取当前 UI/Reducer 的模型状态快照
      const snap = getSnapshot()

      // 尝试读取请求体中的 model 字段
      let reqBodyModel: string | undefined
      try {
        if (init?.body && typeof init.body === "string") {
          const parsed = JSON.parse(init.body)
          reqBodyModel = parsed?.model
        }
      } catch {}

      const reqId = nextReqIdRef.current++
      const when = new Date().toISOString()

      // 失败一次（500），模拟网络错误/上游抖动
      if (options.failFirstRequest && !firstFailedRef.current) {
        firstFailedRef.current = true
        const log: RequestLog = {
          id: reqId,
          when,
          uiSelected: snap.uiSelected,
          reducerModelId: snap.reducerModelId,
          requestBodyModel: reqBodyModel,
          resultStatus: 500,
          note: "Mock 500 on first request",
        }
        setLogs((prev) => [log, ...prev])
        return new Response(JSON.stringify({ error: "Mock upstream 500" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }

      // 正常返回：构造一个简易 SSE 流（OpenAI风格）
      // 可选：延时，模拟慢速网络
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const push = (text: string) => controller.enqueue(encoder.encode(text))

          const sendChunk = (content: string, delay: number) => {
            setTimeout(() => {
              const payload = JSON.stringify({ id: `req_${reqId}`, choices: [{ delta: { content } }] })
              push(`data: ${payload}\n\n`)
            }, delay)
          }

          // 两段内容
          sendChunk("Hello ", options.simulateSlowMs)
          sendChunk("World!", options.simulateSlowMs + 300)

          setTimeout(() => {
            push("data: [DONE]\n\n")
            controller.close()
          }, options.simulateSlowMs + 600)
        },
      })

      const res = new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })

      const okLog: RequestLog = {
        id: reqId,
        when,
        uiSelected: snap.uiSelected,
        reducerModelId: snap.reducerModelId,
        requestBodyModel: reqBodyModel,
        resultStatus: 200,
      }
      setLogs((prev) => [okLog, ...prev])
      return res
    }) as any

    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current
        originalFetchRef.current = null
      }
    }
  }, [getSnapshot, options.failFirstRequest, options.simulateSlowMs])

  return { install, logs }
}

function ChatHarness({
  selectedModelProp,
  omitSelectedOnMount,
  failFirstRequest,
  simulateSlowMs,
  autoSyncUIToReducer,
}: {
  selectedModelProp: string
  omitSelectedOnMount: boolean
  failFirstRequest: boolean
  simulateSlowMs: number
  autoSyncUIToReducer: boolean
}) {
  // 模拟 SmartChat 初始化策略（重要：回退到 ALLOWED_MODELS[0]）
  const initialSettings: ChatSettings = useMemo(() => {
    let modelId = DEFAULT_CHAT_SETTINGS.modelId
    const selected = omitSelectedOnMount ? undefined : selectedModelProp
    if (ALLOWED_MODELS.length > 0) {
      const found = ALLOWED_MODELS.find((m) => m.id === selected)
      modelId = found?.id || ALLOWED_MODELS[0].id
    }
    return { ...DEFAULT_CHAT_SETTINGS, modelId }
  }, [selectedModelProp, omitSelectedOnMount])

  const { state, dispatch } = useChatState({ settings: initialSettings, messages: [] })
  const { sendMessage, updateSettings, clearMessages } = useChatActionsFixed({ state, dispatch })

  // 在 UI 切换时，是否自动同步到 reducer
  useEffect(() => {
    if (!autoSyncUIToReducer) return
    updateSettings({ modelId: selectedModelProp })
  }, [autoSyncUIToReducer, selectedModelProp, updateSettings])

  // 安装 fetch mock（仅对 /api/chat 生效）
  const { install, logs } = useMockChatFetch(
    { failFirstRequest, simulateSlowMs },
    () => ({ uiSelected: selectedModelProp, reducerModelId: state.settings.modelId })
  )

  useEffect(() => install(), [install])

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="text-sm">Harness reducer modelId: <b>{state.settings.modelId}</b></div>
      <div className="flex gap-2">
        <button className="px-2 py-1 border rounded" onClick={() => sendMessage("test message")}>Send</button>
        <button className="px-2 py-1 border rounded" onClick={() => updateSettings({ modelId: selectedModelProp })}>Sync UI→Reducer</button>
        <button className="px-2 py-1 border rounded" onClick={() => clearMessages()}>Clear</button>
      </div>

      <div className="text-xs text-muted-foreground">最近请求日志（最新在前）</div>
      <div className="max-h-60 overflow-auto border rounded p-2 text-xs">
        {logs.map((l) => (
          <div key={l.id} className="py-1 border-b last:border-none">
            <div>#{l.id} [{l.when}] status={l.resultStatus}</div>
            <div>uiSelected={l.uiSelected} | reducer={l.reducerModelId} | body.model={l.requestBodyModel || "(n/a)"}</div>
            {l.note ? <div>note={l.note}</div> : null}
          </div>
        ))}
        {logs.length === 0 && <div>暂无日志</div>}
      </div>
    </div>
  )
}

export default function ModelConsistencyTestPage() {
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)

  // 控制变量
  const [failFirstRequest, setFailFirstRequest] = useState<boolean>(true)
  const [simulateSlowMs, setSimulateSlowMs] = useState<number>(800)
  const [omitSelectedOnMount, setOmitSelectedOnMount] = useState<boolean>(false)
  const [autoSyncUIToReducer, setAutoSyncUIToReducer] = useState<boolean>(false)

  // 通过 key 触发 Harness 重新挂载（模拟错误后的组件重建）
  const [harnessKey, setHarnessKey] = useState<number>(0)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">模型一致性诊断（独立测试）</h1>
      <p className="text-sm text-muted-foreground">
        本页面不会修改生产代码。用于验证：UI→Reducer→API 请求的模型 ID 是否一致；以及网络错误/重挂载是否导致模型回退。
      </p>

      <div className="space-y-2 p-3 border rounded">
        <div className="text-sm">当前 UI 选择模型：<b>{selectedModel}</b></div>
        <ModelSelectorAnimated modelId={selectedModel} onChange={setSelectedModel} />

        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={failFirstRequest} onChange={(e) => setFailFirstRequest(e.target.checked)} />
            首次请求返回 500（模拟网络/上游错误）
          </label>

          <label className="flex items-center gap-1">
            <input type="checkbox" checked={omitSelectedOnMount} onChange={(e) => setOmitSelectedOnMount(e.target.checked)} />
            挂载时不传 selectedModel（模拟 undefined，触发默认回退）
          </label>

          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoSyncUIToReducer} onChange={(e) => setAutoSyncUIToReducer(e.target.checked)} />
            自动将 UI 选择同步到 reducer（避免不一致）
          </label>

          <label className="flex items-center gap-1">
            SSE延迟(ms):
            <input
              type="number"
              className="px-2 py-1 border rounded w-24"
              value={simulateSlowMs}
              onChange={(e) => setSimulateSlowMs(Number(e.target.value) || 0)}
            />
          </label>

          <button className="px-2 py-1 border rounded" onClick={() => setHarnessKey((k) => k + 1)}>
            重新挂载 Harness（模拟错误后的重建）
          </button>
        </div>
      </div>

      <ChatHarness
        key={harnessKey}
        selectedModelProp={selectedModel}
        omitSelectedOnMount={omitSelectedOnMount}
        failFirstRequest={failFirstRequest}
        simulateSlowMs={simulateSlowMs}
        autoSyncUIToReducer={autoSyncUIToReducer}
      />

      <div className="text-sm text-muted-foreground">
        使用建议：
        <ol className="list-decimal ml-5 space-y-1">
          <li>先选择 Gemini（gemini-2.5-pro-preview-06-05）。</li>
          <li>勾选“首次请求 500”和“挂载时不传 selectedModel”。点击“Send”，再“重新挂载”。观察日志中 body.model 是否回退到 ALLOWED_MODELS[0]。</li>
          <li>取消“挂载时不传 selectedModel”，勾选“自动同步 UI→reducer”，再次发送，确认三处一致性（uiSelected / reducer / body.model）。</li>
          <li>调整 SSE 延迟，观察长耗时是否影响一致性（不应影响）。</li>
        </ol>
      </div>
    </div>
  )
}

