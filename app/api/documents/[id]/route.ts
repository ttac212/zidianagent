import type { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 模拟获取单个文档
    const document = {
      id,
      title: "示例文档标题",
      content: "这是文档的详细内容...",
      category: "短视频文案",
      tags: ["热门", "原创"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      wordCount: 150,
      status: "draft",
      author: "当前用户",
      aiGenerated: true,
      versions: [
        {
          version: 1,
          content: "这是文档的详细内容...",
          updatedAt: new Date().toISOString(),
          comment: "初始版本",
        },
      ],
    }

    return Response.json({
      success: true,
      data: document,
    })
  } catch (error) {
    void error
    return Response.json({ success: false, error: "获取文档失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { title, content, category, tags, versionComment } = await request.json()

    // 模拟更新文档
    const updatedDocument = {
      id,
      title,
      content,
      category,
      tags,
      updatedAt: new Date().toISOString(),
      version: 2,
      wordCount: content.split(/\s+/).length,
      versionComment,
    }

    return Response.json({
      success: true,
      data: updatedDocument,
      message: "文档更新成功",
    })
  } catch (error) {
    void error
    return Response.json({ success: false, error: "更新文档失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 模拟删除文档
    return Response.json({
      success: true,
      message: "文档删除成功",
    })
  } catch (error) {
    void error
    return Response.json({ success: false, error: "删除文档失败" }, { status: 500 })
  }
}
