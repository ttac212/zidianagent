import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { FeedbackStatus, FeedbackType, FeedbackPriority } from "@prisma/client"

// 状态映射函数
function mapStringToStatus(status: string): FeedbackStatus {
  const mapping: Record<string, FeedbackStatus> = {
    "pending": FeedbackStatus.OPEN,
    "in-progress": FeedbackStatus.IN_PROGRESS,
    "resolved": FeedbackStatus.RESOLVED,
    "closed": FeedbackStatus.CLOSED,
    "rejected": FeedbackStatus.REJECTED,
  }
  return mapping[status] || FeedbackStatus.OPEN
}

function mapStatusToString(status: FeedbackStatus): string {
  const mapping: Record<FeedbackStatus, string> = {
    [FeedbackStatus.OPEN]: "pending",
    [FeedbackStatus.IN_PROGRESS]: "in-progress",
    [FeedbackStatus.RESOLVED]: "resolved",
    [FeedbackStatus.CLOSED]: "closed",
    [FeedbackStatus.REJECTED]: "rejected",
  }
  return mapping[status]
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

function mapPriorityToString(priority: FeedbackPriority): string {
  return priority.toLowerCase()
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // 从数据库获取反馈详情
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    })

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "反馈不存在" },
        { status: 404 }
      )
    }

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
      upvotes: 0,
      tags: [],
      replies: feedback.response ? [{
        id: "response",
        content: feedback.response,
        author: "系统",
        createdAt: feedback.handledAt?.toISOString() || feedback.updatedAt.toISOString(),
        isAdmin: true,
      }] : [],
    }

    return NextResponse.json({
      success: true,
      data: formattedFeedback,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "获取反馈详情失败" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const { status, reply, priority } = body

    // 构建更新数据
    const updateData: any = {}

    // 更新状态
    if (status) {
      updateData.status = mapStringToStatus(status)
      
      // 如果状态改为处理中、已解决或已关闭，记录处理时间
      if (["in-progress", "resolved", "closed"].includes(status)) {
        updateData.handledAt = new Date()
      }
    }

    // 添加回复
    if (reply) {
      updateData.response = reply
      updateData.handledAt = new Date()
      // 如果添加了回复但没有指定状态，自动设置为已解决
      if (!status) {
        updateData.status = FeedbackStatus.RESOLVED
      }
    }

    // 更新优先级
    if (priority) {
      const priorityMapping: Record<string, FeedbackPriority> = {
        "low": FeedbackPriority.LOW,
        "medium": FeedbackPriority.MEDIUM,
        "high": FeedbackPriority.HIGH,
        "urgent": FeedbackPriority.URGENT,
      }
      updateData.priority = priorityMapping[priority] || FeedbackPriority.MEDIUM
    }

    // 更新数据库
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
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
      id: updatedFeedback.id,
      title: updatedFeedback.title,
      content: updatedFeedback.content,
      category: mapTypeToCategory(updatedFeedback.type),
      priority: mapPriorityToString(updatedFeedback.priority),
      status: mapStatusToString(updatedFeedback.status),
      createdAt: updatedFeedback.createdAt.toISOString(),
      updatedAt: updatedFeedback.updatedAt.toISOString(),
      author: updatedFeedback.authorName || updatedFeedback.user?.displayName || "匿名用户",
      contactInfo: updatedFeedback.contactInfo || updatedFeedback.user?.email || "",
      replies: updatedFeedback.response ? [{
        id: "response",
        content: updatedFeedback.response,
        author: "系统",
        createdAt: updatedFeedback.handledAt?.toISOString() || updatedFeedback.updatedAt.toISOString(),
        isAdmin: true,
      }] : [],
    }

    return NextResponse.json({
      success: true,
      data: formattedFeedback,
      message: "反馈更新成功",
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "更新反馈失败" },
      { status: 500 }
    )
  }
}
