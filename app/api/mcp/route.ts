import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getMCPManager } from "@/lib/mcp/client-manager"
import { MCP_SERVERS } from "@/lib/mcp/servers"

export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return new Response(JSON.stringify({ error: "未认证" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    const mcpManager = getMCPManager()
    
    // 获取所有客户端状态
    const clientStatus = mcpManager.getAllClientStatus()
    
    // 健康检查
    const healthStatus = await mcpManager.healthCheck()
    
    // 获取可用工具
    const tools = await mcpManager.getAllTools()
    
    const response = {
      success: true,
      timestamp: Date.now(),
      servers: Object.values(MCP_SERVERS).map(serverConfig => {
        const status = clientStatus.find(s => s.id === serverConfig.id)
        const health = healthStatus.find(h => h.serverId === serverConfig.id)
        
        return {
          id: serverConfig.id,
          name: serverConfig.name,
          description: serverConfig.description,
          type: serverConfig.type,
          enabled: serverConfig.enabled,
          status: status?.status || 'disconnected',
          toolsCount: status?.toolsCount || 0,
          responseTime: health?.responseTime,
          lastCheck: health?.lastCheck || status?.lastCheck,
          error: status?.error || health?.error
        }
      }),
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId,
        serverName: tool.serverName
      })),
      stats: {
        totalServers: Object.keys(MCP_SERVERS).length,
        enabledServers: Object.values(MCP_SERVERS).filter(s => s.enabled).length,
        connectedServers: clientStatus.filter(s => s.status === 'connected').length,
        totalTools: tools.length
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    })

  } catch (error: any) {
    console.error('MCP Status API Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error?.message || "获取MCP状态失败",
      timestamp: Date.now()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return new Response(JSON.stringify({ error: "未认证" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    const { action, serverId, toolName, toolArgs } = await request.json()

    const mcpManager = getMCPManager()

    switch (action) {
      case 'connect':
        if (!serverId) {
          return new Response(JSON.stringify({ error: "缺少serverId参数" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        try {
          const clientWrapper = await mcpManager.createClient(serverId)
          return new Response(JSON.stringify({
            success: true,
            message: `成功连接到服务器: ${clientWrapper.name}`,
            server: {
              id: clientWrapper.id,
              name: clientWrapper.name,
              status: clientWrapper.status,
              toolsCount: Object.keys(clientWrapper.tools || {}).length,
              connectedAt: clientWrapper.connectedAt
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: `连接服务器失败: ${error.message}`
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          })
        }

      case 'disconnect':
        if (!serverId) {
          return new Response(JSON.stringify({ error: "缺少serverId参数" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        await mcpManager.closeClient(serverId)
        return new Response(JSON.stringify({
          success: true,
          message: `已断开服务器连接: ${serverId}`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })

      case 'callTool':
        if (!toolName) {
          return new Response(JSON.stringify({ error: "缺少toolName参数" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        try {
          const result = await mcpManager.callTool(toolName, toolArgs || {})
          return new Response(JSON.stringify({
            success: true,
            tool: toolName,
            result: result
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: `工具调用失败: ${error.message}`,
            tool: toolName
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          })
        }

      case 'healthCheck':
        const healthStatus = await mcpManager.healthCheck()
        return new Response(JSON.stringify({
          success: true,
          healthStatus: healthStatus
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })

      default:
        return new Response(JSON.stringify({
          error: `不支持的操作: ${action}`
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
    }

  } catch (error: any) {
    console.error('MCP Action API Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error?.message || "MCP操作失败",
      timestamp: Date.now()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}