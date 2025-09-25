/**
 * MCP客户端管理器
 * 负责管理MCP服务器连接、工具获取和健康检查
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type {
  MCPClientWrapper,
  MCPTool,
  MCPHealthStatus,
  MCPManagerConfig,
  MCPServerStatus
} from './types'
import { getServerConfig, validateServerConfig } from './servers'

export class MCPClientManager {
  private clients: Map<string, MCPClientWrapper> = new Map()
  private config: MCPManagerConfig
  private healthCheckTimer?: NodeJS.Timeout

  constructor(config: Partial<MCPManagerConfig> = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      healthCheckInterval: config.healthCheckInterval || 60000,
      enableLogging: config.enableLogging ?? true,
      ...config
    }

    // 启动健康检查定时器
    if (this.config.healthCheckInterval > 0) {
      this.startHealthCheck()
    }
  }

  /**
   * 创建MCP客户端连接
   */
  async createClient(serverId: string): Promise<MCPClientWrapper> {
    const serverConfig = getServerConfig(serverId)
    if (!serverConfig) {
      throw new Error(`未找到服务器配置: ${serverId}`)
    }

    if (!validateServerConfig(serverConfig)) {
      throw new Error(`无效的服务器配置: ${serverId}`)
    }

    // 检查是否已存在连接
    if (this.clients.has(serverId)) {
      const existing = this.clients.get(serverId)!
      if (existing.status === 'connected') {
        return existing
      }
      // 清理旧连接
      await this.closeClient(serverId)
    }

    // 检查连接数限制
    if (this.clients.size >= this.config.maxConnections) {
      throw new Error(`已达到最大连接数限制: ${this.config.maxConnections}`)
    }

    const clientWrapper: MCPClientWrapper = {
      id: serverId,
      name: serverConfig.name,
      client: new Client(
        {
          name: `zhidian-ai-${serverId}`,
          version: "1.0.0"
        },
        {
          capabilities: {}
        }
      ),
      status: 'connecting'
    }

    this.clients.set(serverId, clientWrapper)

    try {
      // 创建传输层
      let transport
      if (serverConfig.type === 'stdio') {
        transport = new StdioClientTransport({
          command: serverConfig.config.command!,
          args: serverConfig.config.args || [],
          env: serverConfig.config.env
        })
      } else if (serverConfig.type === 'sse') {
        transport = new SSEClientTransport(new URL(serverConfig.config.url!))
      } else {
        throw new Error(`不支持的传输类型: ${serverConfig.type}`)
      }

      // 设置连接超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('连接超时')), this.config.connectionTimeout)
      })

      // 连接到服务器
      await Promise.race([
        clientWrapper.client.connect(transport),
        timeoutPromise
      ])

      // 获取工具列表
      const tools = await this.getClientTools(clientWrapper.client)
      
      clientWrapper.status = 'connected'
      clientWrapper.tools = tools
      clientWrapper.connectedAt = new Date()

      if (this.config.enableLogging) {
        // MCP client connected with ${tools.length} tools
      }

      return clientWrapper

    } catch (error: any) {
      clientWrapper.status = 'error'
      clientWrapper.lastError = error.message

      if (this.config.enableLogging) {
        }

      throw error
    }
  }

  /**
   * 获取客户端工具
   */
  private async getClientTools(client: Client): Promise<Record<string, any>> {
    try {
      const response = await client.request(
        { method: "tools/list" },
        {} as any
      )
      
      const tools: Record<string, any> = {}
      if (response && typeof response === 'object' && 'tools' in response && Array.isArray(response.tools)) {
        for (const tool of response.tools) {
          tools[tool.name] = {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }
        }
      }
      
      return tools
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      return {}
    }
  }

  /**
   * 获取所有可用工具
   */
  async getAllTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = []
    
    for (const [serverId, clientWrapper] of this.clients) {
      if (clientWrapper.status === 'connected' && clientWrapper.tools) {
        for (const [toolName, toolInfo] of Object.entries(clientWrapper.tools)) {
          allTools.push({
            name: toolName,
            description: toolInfo.description,
            inputSchema: toolInfo.inputSchema,
            serverId: serverId,
            serverName: clientWrapper.name
          })
        }
      }
    }
    
    return allTools
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: any): Promise<any> {
    // 找到包含该工具的客户端
    for (const [_serverId, clientWrapper] of this.clients) {
      if (clientWrapper.status === 'connected' && 
          clientWrapper.tools && 
          clientWrapper.tools[toolName]) {
        
        try {
          const result = await clientWrapper.client.request({
            method: "tools/call",
            params: {
              name: toolName,
              arguments: args
            }
          },
          {} as any)
          
          return result
        } catch (error: any) {
          if (this.config.enableLogging) {
            }
          throw error
        }
      }
    }
    
    throw new Error(`未找到工具: ${toolName}`)
  }

  /**
   * 关闭客户端连接
   */
  async closeClient(serverId: string): Promise<void> {
    const clientWrapper = this.clients.get(serverId)
    if (!clientWrapper) {
      return
    }

    try {
      await clientWrapper.client.close()
      if (this.config.enableLogging) {
        }
    } catch (_error: any) {
      } finally {
      this.clients.delete(serverId)
    }
  }

  /**
   * 关闭所有客户端连接
   */
  async closeAllClients(): Promise<void> {
    const closePromises = Array.from(this.clients.keys()).map(serverId => 
      this.closeClient(serverId)
    )
    await Promise.all(closePromises)
  }

  /**
   * 获取客户端状态
   */
  getClientStatus(serverId: string): MCPClientWrapper | undefined {
    return this.clients.get(serverId)
  }

  /**
   * 获取所有客户端状态
   */
  getAllClientStatus(): MCPServerStatus[] {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      name: client.name,
      status: client.status,
      toolsCount: Object.keys(client.tools || {}).length,
      lastCheck: client.connectedAt || new Date(),
      error: client.lastError
    }))
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<MCPHealthStatus[]> {
    const results: MCPHealthStatus[] = []
    
    for (const [serverId, clientWrapper] of this.clients) {
      const startTime = Date.now()
      
      try {
        if (clientWrapper.status === 'connected') {
          // 简单的ping测试
          await clientWrapper.client.request(
            { method: "ping" },
            {} as any
          )
          
          results.push({
            serverId,
            serverName: clientWrapper.name,
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date()
          })
        } else {
          results.push({
            serverId,
            serverName: clientWrapper.name,
            status: 'unhealthy',
            lastCheck: new Date(),
            error: clientWrapper.lastError || '未连接'
          })
        }
      } catch (error: any) {
        results.push({
          serverId,
          serverName: clientWrapper.name,
          status: 'unhealthy',
          lastCheck: new Date(),
          error: error.message
        })
      }
    }
    
    return results
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.healthCheck()
      } catch (_error) {
        }
    }, this.config.healthCheckInterval)
  }

  /**
   * 停止健康检查定时器
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    this.stopHealthCheck()
    await this.closeAllClients()
  }
}

// 全局MCP管理器实例
let globalMCPManager: MCPClientManager | null = null

/**
 * 获取全局MCP管理器实例
 */
export function getMCPManager(): MCPClientManager {
  if (!globalMCPManager) {
    globalMCPManager = new MCPClientManager()
  }
  return globalMCPManager
}

/**
 * 销毁全局MCP管理器实例
 */
export async function destroyMCPManager(): Promise<void> {
  if (globalMCPManager) {
    await globalMCPManager.destroy()
    globalMCPManager = null
  }
}