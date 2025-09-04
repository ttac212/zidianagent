import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// 模拟MCP服务器响应
const mockMCPServers = {
  filesystem: {
    name: "文件系统服务器",
    available: true,
    tools: ["listFiles", "readFile", "writeFile", "deleteFile"],
    mockResponse: {
      files: [
        "app/",
        "components/",
        "lib/",
        "package.json",
        "next.config.mjs",
        "README.md",
        "tailwind.config.ts",
        "tsconfig.json"
      ],
      totalFiles: 156,
      totalDirectories: 23
    }
  },
  database: {
    name: "数据库服务器", 
    available: true,
    tools: ["queryUsers", "queryConversations", "queryDocuments"],
    mockResponse: {
      users: 25,
      conversations: 142,
      documents: 89,
      recentActivity: "最近30天新增用户12人，对话增长35%"
    }
  },
  documents: {
    name: "文档服务器",
    available: true, 
    tools: ["listDocuments", "searchDocuments", "createDocument"],
    mockResponse: {
      totalDocuments: 89,
      categories: ["短视频文案", "产品介绍", "旅游攻略", "美食内容"],
      recentDocuments: [
        "AI写作助手使用指南",
        "短视频脚本创作技巧", 
        "产品功能介绍模板"
      ]
    }
  },
  "web-search": {
    name: "Web搜索服务器",
    available: true,
    tools: ["webSearch", "urlAnalysis", "contentExtraction"],
    mockResponse: {
      searchResults: [
        {
          title: "Model Context Protocol 官方文档",
          url: "https://modelcontextprotocol.io/",
          summary: "MCP标准化AI应用与外部工具的连接方式"
        },
        {
          title: "AI SDK v5 MCP 集成指南",
          url: "https://ai-sdk.dev/cookbook/next/mcp-tools",
          summary: "Next.js应用中实现MCP工具集成的详细教程"
        }
      ]
    }
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

    const { prompt, enabledServers } = await request.json()

    // 验证输入
    if (!prompt || !enabledServers || !Array.isArray(enabledServers)) {
      return new Response(JSON.stringify({ 
        error: "无效的请求参数" 
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    // 模拟MCP处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 生成模拟响应
    let mcpResults: Record<string, any> = {}
    
    for (const serverId of enabledServers) {
      const server = mockMCPServers[serverId as keyof typeof mockMCPServers]
      if (server && server.available) {
        mcpResults[serverId] = {
          serverName: server.name,
          status: "success",
          tools: server.tools,
          response: server.mockResponse
        }
      } else {
        mcpResults[serverId] = {
          serverName: serverId,
          status: "error", 
          error: `MCP服务器 ${serverId} 不可用`
        }
      }
    }

    // 生成基于MCP结果的AI响应
    const generateMockAIResponse = (results: Record<string, any>) => {
      let response = "基于MCP服务器查询结果：\n\n"
      
      if (results.filesystem) {
        const fs = results.filesystem.response
        response += `📁 **文件系统分析**：\n`
        response += `- 项目包含 ${fs.totalFiles} 个文件，${fs.totalDirectories} 个目录\n`
        response += `- 主要目录结构：${fs.files.slice(0, 4).join(", ")}\n\n`
      }
      
      if (results.database) {
        const db = results.database.response
        response += `🗄️ **数据库统计**：\n`
        response += `- 用户总数：${db.users} 人\n`
        response += `- 对话数量：${db.conversations} 个\n`
        response += `- 文档数量：${db.documents} 个\n`
        response += `- ${db.recentActivity}\n\n`
      }
      
      if (results.documents) {
        const docs = results.documents.response
        response += `📝 **文档管理分析**：\n`
        response += `- 文档总数：${docs.totalDocuments} 个\n`
        response += `- 主要分类：${docs.categories.join("、")}\n`
        response += `- 最新文档：${docs.recentDocuments.join("、")}\n\n`
      }
      
      if (results["web-search"]) {
        const search = results["web-search"].response
        response += `🌐 **MCP集成相关资料**：\n`
        search.searchResults.forEach((result: any) => {
          response += `- [${result.title}](${result.url})\n  ${result.summary}\n`
        })
      }
      
      response += `\n✅ **MCP集成状态**: 成功连接 ${Object.keys(results).length} 个服务器，所有工具响应正常。`
      
      return response
    }

    const aiResponse = generateMockAIResponse(mcpResults)

    const response = {
      success: true,
      timestamp: Date.now(),
      prompt,
      enabledServers,
      mcpResults,
      response: aiResponse,
      metadata: {
        serversUsed: enabledServers.length,
        totalTools: Object.values(mcpResults)
          .filter(r => r.status === 'success')
          .reduce((acc, curr) => acc + (curr.tools?.length || 0), 0),
        processingTime: "1.5s"
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
    console.error('MCP Test API Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error?.message || "MCP测试失败",
      timestamp: Date.now()
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}

export async function GET(request: NextRequest) {
  // MCP服务器状态检查
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return new Response(JSON.stringify({ error: "未认证" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      })
    }

    const serverStatus = Object.entries(mockMCPServers).map(([id, server]) => ({
      id,
      name: server.name,
      available: server.available,
      toolsCount: server.tools.length,
      lastCheck: Date.now()
    }))

    return new Response(JSON.stringify({
      success: true,
      servers: serverStatus,
      timestamp: Date.now(),
      mcpVersion: "1.0.0",
      aiSdkVersion: "5.0.18"
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30" 
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: "获取MCP状态失败" 
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    })
  }
}