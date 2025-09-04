import type { NextRequest } from "next/server"
import { generateMockDocuments } from "@/lib/mock-data/documents"

// 简单内存缓存，5分钟过期
let documentsCache: { data: any[], timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "all"
    const search = searchParams.get("search") || ""

    // 检查缓存
    const now = Date.now()
    let documents: any[]
    
    if (documentsCache && (now - documentsCache.timestamp) < CACHE_DURATION) {
      documents = documentsCache.data
    } else {
      // 生成新数据并缓存
      documents = generateMockDocuments()
      documentsCache = { data: documents, timestamp: now }
    }

    // 筛选文档
    const filteredDocuments = documents.filter((doc) => {
      const matchesCategory = category === "all" || doc.category === category
      const matchesSearch =
        search === "" ||
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.content.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })

    const response = Response.json({
      success: true,
      data: filteredDocuments,
      total: filteredDocuments.length,
    })
    
    // 添加缓存头
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    
    return response
  } catch (error) {
    return Response.json({ success: false, error: "获取文档失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, category, tags } = await request.json()

    // 模拟创建文档
    const newDocument = {
      id: `doc_${Date.now()}`,
      title,
      content,
      category,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      wordCount: content.split(/\s+/).length,
      status: "draft",
      author: "当前用户",
    }

    return Response.json({
      success: true,
      data: newDocument,
      message: "文档创建成功",
    })
  } catch (error) {
    return Response.json({ success: false, error: "创建文档失败" }, { status: 500 })
  }
}

