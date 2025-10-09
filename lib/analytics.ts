"use client"

import React from "react"
import * as dt from '@/lib/utils/date-toolkit'

// 数据分析和记录工具类
export interface UserEvent {
  userId?: string
  sessionId: string
  eventType: "page_view" | "chat_message" | "document_create" | "document_edit" | "feedback_submit" | "api_call"
  eventData: Record<string, any>
  timestamp: Date
  userAgent?: string
  ip?: string
}

export interface SystemMetric {
  metricType: "response_time" | "error_rate" | "throughput" | "memory_usage" | "cpu_usage"
  value: number
  timestamp: Date
  metadata?: Record<string, any>
}

class Analytics {
  private events: UserEvent[] = []
  private metrics: SystemMetric[] = []

  // 记录用户事件
  trackEvent(event: Omit<UserEvent, "timestamp">) {
    const fullEvent: UserEvent = {
      ...event,
      timestamp: dt.now(),
    }

    this.events.push(fullEvent)

    // 发送到服务器
    this.sendEventToServer(fullEvent)
  }

  // 记录系统指标
  recordMetric(metric: Omit<SystemMetric, "timestamp">) {
    const fullMetric: SystemMetric = {
      ...metric,
      timestamp: dt.now(),
    }

    this.metrics.push(fullMetric)

    // 发送到服务器
    this.sendMetricToServer(fullMetric)
  }

  // 发送事件到服务器（已禁用 - 使用结构化日志）
  private async sendEventToServer(_event: UserEvent) {
    // SECURITY: Analytics API 已完全禁用
    // 如需追踪，请使用结构化日志系统
    // console.info('[Analytics Event]', event);
  }

  // 发送指标到服务器（已禁用 - 使用结构化日志）
  private async sendMetricToServer(_metric: SystemMetric) {
    // SECURITY: Metrics API 已完全禁用
    // 如需监控，请使用结构化日志系统
    // console.info('[System Metric]', metric);
  }

  // 生成会话ID
  generateSessionId(): string {
    return `session_${dt.timestamp()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 获取用户代理信息
  getUserAgent(): string {
    return typeof window !== "undefined" ? window.navigator.userAgent : ""
  }
}

export const analytics = new Analytics()

// 页面访问追踪Hook
export function usePageTracking(pageName: string) {
  const sessionId = analytics.generateSessionId()

  React.useEffect(() => {
    analytics.trackEvent({
      sessionId,
      eventType: "page_view",
      eventData: {
        page: pageName,
        url: window.location.href,
      },
      userAgent: analytics.getUserAgent(),
    })
  }, [pageName, sessionId])

  return sessionId
}
