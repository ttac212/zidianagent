import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import {
  success,
  forbidden
} from '@/lib/api/http-response'


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const keyword = searchParams.get("keyword") || "断桥铝门窗"

    // SECURITY: 验证keyword参数，防止目录遍历攻击
    // 只允许字母、数字、中文字符、空格和部分安全符号
    const safeKeywordPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_]+$/
    if (!safeKeywordPattern.test(keyword)) {
      return forbidden("非法的关键字参数")
    }

    // SECURITY: 额外检查，防止路径遍历尝试
    if (keyword.includes('..') || keyword.includes('/') || keyword.includes('\\')) {
      return forbidden("检测到路径遍历尝试")
    }

    // 数据文件目录
    const dataDir = path.join(process.cwd(), "keyword_search_aggregated")

    // 获取所有可用的关键字数据文件
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith(".json"))

    // 提取可用的关键字列表
    const availableKeywords = jsonFiles.map(file =>
      file.replace("keyword_data_", "").replace(".json", "")
    )

    // 构建目标文件路径
    const fileName = `keyword_data_${keyword}.json`
    const filePath = path.join(dataDir, fileName)

    // SECURITY: 确保最终路径在预期目录内
    const resolvedPath = path.resolve(filePath)
    const resolvedDataDir = path.resolve(dataDir)
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      return forbidden("非法的文件访问尝试")
    }
    
    try {
      // 读取指定关键字的数据文件
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)
      
      // 添加可用关键字列表到响应中
      return success({
        ...data,  // 展开数据内容
        availableKeywords,
        currentKeyword: keyword
      })
    } catch (_error) {
      // 如果文件不存在，返回可用关键字列表
      return NextResponse.json({
        success: false,
        message: `未找到关键字 "${keyword}" 的数据文件`,
        availableKeywords,
        currentKeyword: null
      }, { status: 404 })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "服务器错误",
      error: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}

// 获取所有可用的关键字列表
export async function POST() {
  try {
    const dataDir = path.join(process.cwd(), "keyword_search_aggregated")
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith(".json"))
    
    const keywordsWithStats = await Promise.all(
      jsonFiles.map(async (file) => {
        const keyword = file.replace("keyword_data_", "").replace(".json", "")
        const filePath = path.join(dataDir, file)
        
        try {
          const content = await fs.readFile(filePath, "utf-8")
          const data = JSON.parse(content)
          
          return {
            keyword,
            videoCount: data.videos?.length || 0,
            totalComments: data.statistics?.实际评论总数 || 0,
            lastUpdated: data.metadata?.last_updated || null
          }
        } catch (_error) {
          return {
            keyword,
            videoCount: 0,
            totalComments: 0,
            lastUpdated: null
          }
        }
      })
    )
    
    return success(keywordsWithStats)
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "服务器错误",
      error: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}
