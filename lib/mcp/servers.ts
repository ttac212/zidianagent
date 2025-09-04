/**
 * MCP服务器配置
 */

import { MCPServerConfig } from './types'

export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  documents: {
    id: 'documents',
    name: '文档管理服务器',
    description: '访问和管理智点AI文档系统',
    type: 'stdio',
    enabled: true,
    config: {
      command: 'node',
      args: ['./mcp-servers/documents-server.js'],
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        DATABASE_URL: process.env.DATABASE_URL || ''
      }
    }
  },
  
  database: {
    id: 'database',
    name: '数据库查询服务器',
    description: '查询Prisma数据库中的用户和统计数据',
    type: 'stdio',
    enabled: true,
    config: {
      command: 'node',
      args: ['./mcp-servers/database-server.js'],
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        DATABASE_URL: process.env.DATABASE_URL || ''
      }
    }
  },
  
  filesystem: {
    id: 'filesystem',
    name: '文件系统服务器',
    description: '安全访问项目文件和目录',
    type: 'stdio',
    enabled: false, // 默认禁用，安全考虑
    config: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', process.cwd()],
      cwd: process.cwd(),
      env: {
        MCP_FILESYSTEM_ALLOWLIST: 'docs/,README.md,package.json'
      }
    }
  },
  
  'web-search': {
    id: 'web-search',
    name: 'Web搜索服务器',
    description: '执行网络搜索和内容分析',
    type: 'stdio',
    enabled: false, // 需要额外配置
    config: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-web-search'],
      cwd: process.cwd(),
      env: {
        SEARCH_API_KEY: process.env.SEARCH_API_KEY || ''
      }
    }
  }
}

/**
 * 获取启用的MCP服务器配置
 */
export function getEnabledServers(): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter(server => server.enabled)
}

/**
 * 获取指定ID的服务器配置
 */
export function getServerConfig(serverId: string): MCPServerConfig | undefined {
  return MCP_SERVERS[serverId]
}

/**
 * 验证服务器配置
 */
export function validateServerConfig(config: MCPServerConfig): boolean {
  if (!config.id || !config.name || !config.type) {
    return false
  }
  
  if (config.type === 'stdio') {
    return !!config.config.command
  }
  
  if (config.type === 'sse' || config.type === 'http') {
    return !!config.config.url
  }
  
  return false
}