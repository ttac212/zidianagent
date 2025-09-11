#!/usr/bin/env node

/**
 * 智点AI文档管理MCP服务器
 * 提供文档CRUD操作工具
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const fs = require('fs').promises
const path = require('path')

// 文档存储路径（使用项目根目录下的文档存储）
const DOCS_STORAGE_PATH = path.join(process.cwd(), 'storage', 'mcp-documents')

// 确保存储目录存在
async function ensureStorageDir() {
  try {
    await fs.access(DOCS_STORAGE_PATH)
  } catch (error) {
    await fs.mkdir(DOCS_STORAGE_PATH, { recursive: true })
  }
}

// 创建MCP服务器
const server = new Server(
  {
    name: "zhidian-documents-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// 工具1: 列出文档
server.addTool({
  name: "list_documents",
  description: "列出所有文档或指定分类的文档",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "文档分类筛选（可选）"
      },
      limit: {
        type: "number",
        description: "返回文档数量限制",
        default: 10
      }
    }
  }
}, async (request) => {
  try {
    await ensureStorageDir()
    
    // 读取所有文档文件
    const files = await fs.readdir(DOCS_STORAGE_PATH)
    const documents = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(DOCS_STORAGE_PATH, file)
          const content = await fs.readFile(filePath, 'utf8')
          const doc = JSON.parse(content)
          
          // 分类筛选
          if (request.params?.category && doc.category !== request.params.category) {
            continue
          }
          
          documents.push({
            id: doc.id,
            title: doc.title,
            category: doc.category || '未分类',
            tags: doc.tags || [],
            wordCount: doc.content ? doc.content.length : 0,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          })
        } catch (e) {
          }
      }
    }
    
    // 按更新时间排序
    documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    
    // 应用数量限制
    const limit = request.params?.limit || 10
    const limitedDocs = documents.slice(0, limit)
    
    const result = {
      total: documents.length,
      documents: limitedDocs,
      category: request.params?.category || '全部',
      timestamp: new Date().toISOString()
    }
    
    return {
      content: [
        {
          type: "text",
          text: `找到 ${result.total} 个文档${request.params?.category ? `（分类：${request.params.category}）` : ''}：\n\n` +
                limitedDocs.map((doc, index) => 
                  `${index + 1}. **${doc.title}**\n` +
                  `   - 分类: ${doc.category}\n` +
                  `   - 字数: ${doc.wordCount}\n` +
                  `   - 标签: ${doc.tags.join(', ') || '无'}\n` +
                  `   - 更新时间: ${new Date(doc.updatedAt).toLocaleString()}\n`
                ).join('\n')
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text", 
          text: `列出文档失败: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

// 工具2: 搜索文档
server.addTool({
  name: "search_documents",
  description: "在文档标题和内容中搜索关键词",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词"
      },
      searchIn: {
        type: "string", 
        enum: ["title", "content", "both"],
        description: "搜索范围：title（标题）、content（内容）、both（标题和内容）",
        default: "both"
      }
    },
    required: ["query"]
  }
}, async (request) => {
  try {
    await ensureStorageDir()
    
    const query = request.params.query.toLowerCase()
    const searchIn = request.params.searchIn || "both"
    const files = await fs.readdir(DOCS_STORAGE_PATH)
    const matchedDocs = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(DOCS_STORAGE_PATH, file)
          const content = await fs.readFile(filePath, 'utf8')
          const doc = JSON.parse(content)
          
          let shouldInclude = false
          
          if (searchIn === 'title' || searchIn === 'both') {
            if (doc.title && doc.title.toLowerCase().includes(query)) {
              shouldInclude = true
            }
          }
          
          if (!shouldInclude && (searchIn === 'content' || searchIn === 'both')) {
            if (doc.content && doc.content.toLowerCase().includes(query)) {
              shouldInclude = true
            }
          }
          
          if (shouldInclude) {
            matchedDocs.push({
              id: doc.id,
              title: doc.title,
              category: doc.category || '未分类',
              tags: doc.tags || [],
              excerpt: doc.content ? doc.content.substring(0, 200) + '...' : '',
              updatedAt: doc.updatedAt
            })
          }
        } catch (e) {
          }
      }
    }
    
    matchedDocs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    
    return {
      content: [
        {
          type: "text",
          text: `搜索 "${query}" 找到 ${matchedDocs.length} 个匹配文档：\n\n` +
                matchedDocs.map((doc, index) =>
                  `${index + 1}. **${doc.title}**\n` +
                  `   - 分类: ${doc.category}\n` +
                  `   - 标签: ${doc.tags.join(', ') || '无'}\n` +
                  `   - 内容摘要: ${doc.excerpt}\n` +
                  `   - 更新时间: ${new Date(doc.updatedAt).toLocaleString()}\n`
                ).join('\n')
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `搜索文档失败: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

// 工具3: 创建文档
server.addTool({
  name: "create_document",
  description: "创建新文档",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "文档标题"
      },
      content: {
        type: "string",
        description: "文档内容（Markdown格式）"
      },
      category: {
        type: "string",
        description: "文档分类",
        default: "未分类"
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "文档标签",
        default: []
      }
    },
    required: ["title", "content"]
  }
}, async (request) => {
  try {
    await ensureStorageDir()
    
    const now = new Date().toISOString()
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const document = {
      id: docId,
      title: request.params.title,
      content: request.params.content,
      category: request.params.category || '未分类',
      tags: request.params.tags || [],
      createdAt: now,
      updatedAt: now,
      version: 1,
      author: 'MCP服务器'
    }
    
    const fileName = `${docId}.json`
    const filePath = path.join(DOCS_STORAGE_PATH, fileName)
    
    await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf8')
    
    return {
      content: [
        {
          type: "text",
          text: `文档创建成功！\n\n` +
                `📄 **${document.title}**\n` +
                `- ID: ${document.id}\n` +
                `- 分类: ${document.category}\n` +
                `- 标签: ${document.tags.join(', ') || '无'}\n` +
                `- 字数: ${document.content.length}\n` +
                `- 创建时间: ${new Date(document.createdAt).toLocaleString()}`
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `创建文档失败: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

// 工具4: 读取文档内容
server.addTool({
  name: "read_document",
  description: "读取指定文档的完整内容",
  inputSchema: {
    type: "object",
    properties: {
      documentId: {
        type: "string",
        description: "文档ID"
      }
    },
    required: ["documentId"]
  }
}, async (request) => {
  try {
    await ensureStorageDir()
    
    const docId = request.params.documentId
    const fileName = `${docId}.json`
    const filePath = path.join(DOCS_STORAGE_PATH, fileName)
    
    const content = await fs.readFile(filePath, 'utf8')
    const document = JSON.parse(content)
    
    return {
      content: [
        {
          type: "text",
          text: `📄 **${document.title}**\n\n` +
                `**基本信息:**\n` +
                `- ID: ${document.id}\n` +
                `- 分类: ${document.category || '未分类'}\n` +
                `- 标签: ${document.tags?.join(', ') || '无'}\n` +
                `- 版本: ${document.version || 1}\n` +
                `- 创建时间: ${new Date(document.createdAt).toLocaleString()}\n` +
                `- 更新时间: ${new Date(document.updatedAt).toLocaleString()}\n\n` +
                `**文档内容:**\n\n${document.content}`
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `读取文档失败: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

// 工具5: 获取文档统计
server.addTool({
  name: "get_document_stats",
  description: "获取文档统计信息",
  inputSchema: {
    type: "object",
    properties: {}
  }
}, async (request) => {
  try {
    await ensureStorageDir()
    
    const files = await fs.readdir(DOCS_STORAGE_PATH)
    const stats = {
      totalDocuments: 0,
      categories: new Set(),
      tags: new Set(),
      totalWords: 0,
      recentDocuments: []
    }
    
    const documents = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(DOCS_STORAGE_PATH, file)
          const content = await fs.readFile(filePath, 'utf8')
          const doc = JSON.parse(content)
          
          stats.totalDocuments++
          if (doc.category) stats.categories.add(doc.category)
          if (doc.tags) doc.tags.forEach(tag => stats.tags.add(tag))
          if (doc.content) stats.totalWords += doc.content.length
          
          documents.push({
            title: doc.title,
            updatedAt: doc.updatedAt
          })
        } catch (e) {
          }
      }
    }
    
    // 获取最近更新的5个文档
    documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    stats.recentDocuments = documents.slice(0, 5)
    
    return {
      content: [
        {
          type: "text",
          text: `📊 **文档统计信息**\n\n` +
                `📄 文档总数: **${stats.totalDocuments}** 个\n` +
                `📂 分类数量: **${stats.categories.size}** 个\n` +
                `🏷️ 标签数量: **${stats.tags.size}** 个\n` +
                `📝 总字数: **${stats.totalWords.toLocaleString()}** 字\n\n` +
                `**分类列表:**\n${Array.from(stats.categories).map(cat => `- ${cat}`).join('\n')}\n\n` +
                `**常用标签:**\n${Array.from(stats.tags).slice(0, 10).map(tag => `- ${tag}`).join('\n')}\n\n` +
                `**最近更新:**\n` +
                stats.recentDocuments.map((doc, index) =>
                  `${index + 1}. ${doc.title} (${new Date(doc.updatedAt).toLocaleDateString()})`
                ).join('\n')
        }
      ],
      isError: false
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `获取统计信息失败: ${error.message}`
        }
      ],
      isError: true
    }
  }
})

async function main() {
  try {
    // 确保存储目录存在
    await ensureStorageDir()
    
    // 创建stdio传输
    const transport = new StdioServerTransport()
    
    // 连接并运行服务器
    await server.connect(transport)
    
    } catch (error) {
    process.exit(1)
  }
}

// 处理优雅退出
process.on('SIGINT', async () => {
  process.exit(0)
})

process.on('SIGTERM', async () => {
  process.exit(0)
})

// 启动服务器
main().catch((error) => {
  process.exit(1)
})