"use client"

import React from "react"

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
      timestamp: new Date(),
    }

    this.events.push(fullEvent)

    // 发送到服务器
    this.sendEventToServer(fullEvent)
  }

  // 记录系统指标
  recordMetric(metric: Omit<SystemMetric, "timestamp">) {
    const fullMetric: SystemMetric = {
      ...metric,
      timestamp: new Date(),
    }

    this.metrics.push(fullMetric)

    // 发送到服务器
    this.sendMetricToServer(fullMetric)
  }

  // 发送事件到服务器
  private async sendEventToServer(event: UserEvent) {
    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      })
    } catch (error) {
      }
  }

  // 发送指标到服务器
  private async sendMetricToServer(metric: SystemMetric) {
    try {
      await fetch("/api/analytics/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metric),
      })
    } catch (error) {
      }
  }

  // 生成会话ID
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
