/**
 * MCP (Model Context Protocol) 类型定义
 */

import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js'

export interface MCPServerConfig {
  id: string
  name: string
  description: string
  type: 'stdio' | 'sse' | 'http'
  enabled: boolean
  config: {
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
    url?: string
    headers?: Record<string, string>
  }
}

export interface MCPClientWrapper {
  id: string
  name: string
  client: MCPClient
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastError?: string
  tools?: Record<string, any>
  connectedAt?: Date
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: any
  serverId: string
  serverName: string
}

export interface MCPHealthStatus {
  serverId: string
  serverName: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  responseTime?: number
  lastCheck: Date
  error?: string
}

export interface MCPManagerConfig {
  maxConnections: number
  connectionTimeout: number
  healthCheckInterval: number
  enableLogging: boolean
}

export interface MCPServerStatus {
  id: string
  name: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  toolsCount: number
  lastCheck: Date
  responseTime?: number
  error?: string
}