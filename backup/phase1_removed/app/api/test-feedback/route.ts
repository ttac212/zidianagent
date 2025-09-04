import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // 尝试计数反馈数量
    const count = await prisma.feedback.count()
    
    return NextResponse.json({
      success: true,
      message: "数据库连接成功",
      feedbackCount: count,
    })
  } catch (error) {
    console.error("数据库错误:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      details: JSON.stringify(error, null, 2)
    }, { status: 500 })
  }
}