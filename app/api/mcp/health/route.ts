import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getMCPManager } from "@/lib/mcp/client-manager"
import { MCP_SERVERS, getEnabledServers } from "@/lib/mcp/servers"

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
    
    // 获取详细的健康状态
    const healthStatus = await mcpManager.healthCheck()
    const clientStatus = mcpManager.getAllClientStatus()
    
    // 计算整体系统状态
    const totalServers = Object.keys(MCP_SERVERS).length
    const enabledServers = getEnabledServers().length
    const connectedServers = clientStatus.filter(s => s.status === 'connected').length
    const healthyServers = healthStatus.filter(h => h.status === 'healthy').length
    
    // 系统健康度评分 (0-100)
    let healthScore = 0
    if (enabledServers > 0) {
      healthScore = Math.round((healthyServers / enabledServers) * 100)
    }
    
    // 确定整体状态
    let overallStatus = 'unknown'
    if (enabledServers === 0) {
      overallStatus = 'no_servers_enabled'
    } else if (healthyServers === enabledServers) {
      overallStatus = 'healthy'
    } else if (healthyServers > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'unhealthy'
    }
    
    // 收集错误和警告
    const errors: string[] = []
    const warnings: string[] = []
    
    healthStatus.forEach(health => {
      if (health.status === 'unhealthy' && health.error) {
        errors.push(`${health.serverName}: ${health.error}`)
      }
      if (health.responseTime && health.responseTime > 5000) {
        warnings.push(`${health.serverName}: 响应时间较慢 (${health.responseTime}ms)`)
      }
    })
    
    // 性能统计
    const responseTimes = healthStatus
      .filter(h => h.responseTime !== undefined)
      .map(h => h.responseTime!)
    
    const avgResponseTime = responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : undefined
      
    const maxResponseTime = responseTimes.length > 0 
      ? Math.max(...responseTimes) 
      : undefined

    const response = {
      success: true,
      timestamp: Date.now(),
      overallStatus,
      healthScore,
      
      // 服务器统计
      serverStats: {
        total: totalServers,
        enabled: enabledServers,
        connected: connectedServers,
        healthy: healthyServers,
        disconnected: enabledServers - connectedServers,
        unhealthy: connectedServers - healthyServers
      },
      
      // 性能指标
      performance: {
        averageResponseTime: avgResponseTime,
        maxResponseTime: maxResponseTime,
        responseTimes: healthStatus.map(h => ({
          serverId: h.serverId,
          serverName: h.serverName,
          responseTime: h.responseTime
        })).filter(r => r.responseTime !== undefined)
      },
      
      // 详细的服务器状态
      servers: Object.values(MCP_SERVERS).map(serverConfig => {
        const status = clientStatus.find(s => s.id === serverConfig.id)
        const health = healthStatus.find(h => h.serverId === serverConfig.id)
        
        return {
          id: serverConfig.id,
          name: serverConfig.name,
          description: serverConfig.description,
          enabled: serverConfig.enabled,
          type: serverConfig.type,
          
          // 连接状态
          connectionStatus: status?.status || 'disconnected',
          toolsCount: status?.toolsCount || 0,
          connectedAt: status?.lastCheck,
          
          // 健康状态
          healthStatus: health?.status || 'unknown',
          responseTime: health?.responseTime,
          lastHealthCheck: health?.lastCheck,
          
          // 错误信息
          error: status?.error || health?.error
        }
      }),
      
      // 问题报告
      issues: {
        errors: errors,
        warnings: warnings,
        hasIssues: errors.length > 0 || warnings.length > 0
      },
      
      // 建议
      recommendations: generateRecommendations(overallStatus, healthScore, errors, warnings)
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    })

  } catch (error: any) {
    console.error('MCP Health Check Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error?.message || "健康检查失败",
      timestamp: Date.now(),
      overallStatus: 'error'
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}

function generateRecommendations(
  overallStatus: string, 
  healthScore: number, 
  errors: string[], 
  warnings: string[]
): string[] {
  const recommendations: string[] = []
  
  if (overallStatus === 'no_servers_enabled') {
    recommendations.push('建议启用至少一个MCP服务器以开始使用MCP功能')
  }
  
  if (overallStatus === 'unhealthy') {
    recommendations.push('所有MCP服务器都处于不健康状态，请检查服务器配置和网络连接')
  }
  
  if (overallStatus === 'degraded') {
    recommendations.push('部分MCP服务器存在问题，建议检查错误日志并重启问题服务器')
  }
  
  if (healthScore < 80 && healthScore > 0) {
    recommendations.push(`系统健康度较低 (${healthScore}%)，建议检查服务器状态`)
  }
  
  if (errors.length > 0) {
    recommendations.push('发现连接错误，请检查服务器配置和依赖项')
  }
  
  if (warnings.length > 0) {
    recommendations.push('发现性能警告，考虑优化服务器响应时间')
  }
  
  if (recommendations.length === 0 && overallStatus === 'healthy') {
    recommendations.push('所有MCP服务器运行正常，系统状态良好')
  }
  
  return recommendations
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

    const { action, serverId } = await request.json()

    const mcpManager = getMCPManager()

    switch (action) {
      case 'restart':
        if (!serverId) {
          return new Response(JSON.stringify({ error: "缺少serverId参数" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          })
        }

        // 重启指定服务器
        try {
          await mcpManager.closeClient(serverId)
          await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
          const clientWrapper = await mcpManager.createClient(serverId)
          
          return new Response(JSON.stringify({
            success: true,
            message: `服务器 ${clientWrapper.name} 重启成功`,
            server: {
              id: clientWrapper.id,
              name: clientWrapper.name,
              status: clientWrapper.status
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: `重启服务器失败: ${error.message}`
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          })
        }

      case 'restart_all':
        // 重启所有已连接的服务器
        try {
          const clientStatus = mcpManager.getAllClientStatus()
          const connectedServers = clientStatus.filter(s => s.status === 'connected')
          
          const restartPromises = connectedServers.map(async (server) => {
            try {
              await mcpManager.closeClient(server.id)
              await new Promise(resolve => setTimeout(resolve, 500))
              await mcpManager.createClient(server.id)
              return { serverId: server.id, success: true }
            } catch (error: any) {
              return { serverId: server.id, success: false, error: error.message }
            }
          })
          
          const results = await Promise.all(restartPromises)
          const successful = results.filter(r => r.success).length
          const failed = results.filter(r => !r.success)
          
          return new Response(JSON.stringify({
            success: failed.length === 0,
            message: `${successful} 个服务器重启成功${failed.length > 0 ? `, ${failed.length} 个失败` : ''}`,
            results: results
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: `批量重启失败: ${error.message}`
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          })
        }

      default:
        return new Response(JSON.stringify({
          error: `不支持的操作: ${action}`
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
    }

  } catch (error: any) {
    console.error('MCP Health Action Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error?.message || "健康检查操作失败",
      timestamp: Date.now()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}