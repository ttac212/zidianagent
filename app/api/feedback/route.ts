import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { FeedbackType, FeedbackStatus, FeedbackPriority } from "@prisma/client"

// 类型映射函数
function mapCategoryToType(category: string): FeedbackType {
  const mapping: Record<string, FeedbackType> = {
    "功能建议": FeedbackType.FEATURE_REQUEST,
    "问题报告": FeedbackType.BUG_REPORT,
    "使用体验": FeedbackType.IMPROVEMENT,
    "性能优化": FeedbackType.IMPROVEMENT,
    "界面设计": FeedbackType.IMPROVEMENT,
  }
  return mapping[category] || FeedbackType.OTHER
}

function mapTypeToCategory(type: FeedbackType): string {
  const mapping: Record<FeedbackType, string> = {
    [FeedbackType.FEATURE_REQUEST]: "功能建议",
    [FeedbackType.BUG_REPORT]: "问题报告",
    [FeedbackType.IMPROVEMENT]: "使用体验",
    [FeedbackType.COMPLAINT]: "投诉",
    [FeedbackType.COMPLIMENT]: "表扬",
    [FeedbackType.OTHER]: "其他",
  }
  return mapping[type] || "其他"
}

function mapStatusToString(status: FeedbackStatus): string {
  const mapping: Record<FeedbackStatus, string> = {
    [FeedbackStatus.OPEN]: "pending",
    [FeedbackStatus.IN_PROGRESS]: "in-progress",
    [FeedbackStatus.RESOLVED]: "resolved",
    [FeedbackStatus.CLOSED]: "closed",
    [FeedbackStatus.REJECTED]: "closed",
  }
  return mapping[status]
}

function mapStringToStatus(status: string): FeedbackStatus {
  const mapping: Record<string, FeedbackStatus> = {
    "pending": FeedbackStatus.OPEN,
    "in-progress": FeedbackStatus.IN_PROGRESS,
    "resolved": FeedbackStatus.RESOLVED,
    "closed": FeedbackStatus.CLOSED,
  }
  return mapping[status] || FeedbackStatus.OPEN
}

function mapPriorityToString(priority: FeedbackPriority): string {
  return priority.toLowerCase()
}

function mapStringToPriority(priority: string): FeedbackPriority {
  const mapping: Record<string, FeedbackPriority> = {
    "low": FeedbackPriority.LOW,
    "medium": FeedbackPriority.MEDIUM,
    "high": FeedbackPriority.HIGH,
    "urgent": FeedbackPriority.URGENT,
  }
  return mapping[priority] || FeedbackPriority.MEDIUM
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "all"
    const status = searchParams.get("status") || "all"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")

    // 构建查询条件
    const where: any = {}
    
    if (category !== "all") {
      where.type = mapCategoryToType(category)
    }
    
    if (status !== "all") {
      where.status = mapStringToStatus(status)
    }

    // 获取总数
    const total = await prisma.feedback.count({ where })

    // 获取分页数据
    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 转换数据格式以适配前端
    const formattedFeedbacks = feedbacks.map((feedback) => ({
      id: feedback.id,
      title: feedback.title,
      content: feedback.content,
      category: mapTypeToCategory(feedback.type),
      priority: mapPriorityToString(feedback.priority),
      status: mapStatusToString(feedback.status),
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      author: feedback.authorName || feedback.user?.displayName || "匿名用户",
      contactInfo: feedback.contactInfo || feedback.user?.email || "",
      upvotes: 0, // 简化版不实现点赞
      tags: [], // 简化版不实现标签
      replies: feedback.response ? [{
        id: "response",
        content: feedback.response,
        author: "系统",
        createdAt: feedback.handledAt?.toISOString() || feedback.updatedAt.toISOString(),
        isAdmin: true,
      }] : [],
    }))

    return NextResponse.json({
      success: true,
      data: {
        feedbacks: formattedFeedbacks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { success: false, error: "获取反馈失败" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, category, priority, contactInfo, authorName } = await request.json()

    // 验证必填字段
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "标题和内容不能为空" },
        { status: 400 }
      )
    }

    // 创建反馈
    const feedback = await prisma.feedback.create({
      data: {
        title,
        content,
        type: mapCategoryToType(category),
        priority: mapStringToPriority(priority),
        status: FeedbackStatus.OPEN,
        contactInfo,
        authorName: authorName || "匿名用户",
        userId: null, // 匿名反馈，不关联用户
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    })

    // 格式化返回数据
    const formattedFeedback = {
      id: feedback.id,
      title: feedback.title,
      content: feedback.content,
      category: mapTypeToCategory(feedback.type),
      priority: mapPriorityToString(feedback.priority),
      status: mapStatusToString(feedback.status),
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      author: feedback.authorName || feedback.user?.displayName || "匿名用户",
      contactInfo: feedback.contactInfo || feedback.user?.email || "",
      replies: [],
    }

    return NextResponse.json({
      success: true,
      data: formattedFeedback,
      message: "反馈提交成功",
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { 
        success: false, 
        error: "提交反馈失败",
        message: error instanceof Error ? error.message : "未知错误",
        details: JSON.stringify(error, null, 2)
      },
      { status: 500 }
    )
  }
}