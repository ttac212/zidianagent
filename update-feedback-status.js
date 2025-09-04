const { PrismaClient, FeedbackStatus } = require("@prisma/client")
const prisma = new PrismaClient()

// 状态映射
const statusMap = {
  "待处理": FeedbackStatus.OPEN,
  "处理中": FeedbackStatus.IN_PROGRESS,
  "已解决": FeedbackStatus.RESOLVED,
  "已关闭": FeedbackStatus.CLOSED,
  "已拒绝": FeedbackStatus.REJECTED,
}

async function updateFeedbackStatus(feedbackId, newStatus) {
  try {
    // 检查反馈是否存在
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    })

    if (!existingFeedback) {
      return
    }

    // 更新反馈状态
    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: newStatus,
        handledAt: ["IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"].includes(newStatus) ? new Date() : undefined,
      },
    })

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 使用示例 - 通过API更新（推荐）
async function updateViaAPI(feedbackId, status) {
  const baseUrl = "http://localhost:3007" // 根据实际端口调整
  
  try {
    const response = await fetch(`${baseUrl}/api/feedback/${feedbackId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: status, // "pending", "in-progress", "resolved", "closed"
      }),
    })

    const result = await response.json()
    
    if (result.success) {
      } else {
      }
  } catch (error) {
    }
}

// 批量更新所有待处理的反馈
async function updateAllPendingFeedbacks() {
  try {
    const pendingFeedbacks = await prisma.feedback.findMany({
      where: { status: FeedbackStatus.OPEN },
    })

    for (const feedback of pendingFeedbacks) {
      // 根据需要选择新状态
      // 这里示例将所有待处理改为已解决
      await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          status: FeedbackStatus.RESOLVED,
          handledAt: new Date(),
          response: "该反馈已被自动处理", // 可选：添加处理回复
        },
      })
      
      }

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 查看所有反馈状态
async function listAllFeedbacks() {
  try {
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
    })

    )
    
    feedbacks.forEach((feedback, index) => {
      )
    })
  } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 主函数 - 根据命令行参数执行不同操作
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case "list":
      // 列出所有反馈
      await listAllFeedbacks()
      break
      
    case "update":
      // 更新单个反馈状态
      // 用法: node update-feedback-status.js update <feedbackId> <newStatus>
      const feedbackId = args[1]
      const newStatus = args[2] // OPEN, IN_PROGRESS, RESOLVED, CLOSED, REJECTED
      
      if (!feedbackId || !newStatus) {
        break
      }
      
      await updateFeedbackStatus(feedbackId, FeedbackStatus[newStatus])
      break
      
    case "update-api":
      // 通过API更新
      // 用法: node update-feedback-status.js update-api <feedbackId> <status>
      const apiId = args[1]
      const apiStatus = args[2] // pending, in-progress, resolved, closed
      
      if (!apiId || !apiStatus) {
        break
      }
      
      await updateViaAPI(apiId, apiStatus)
      break
      
    case "batch":
      // 批量更新所有待处理的反馈
      await updateAllPendingFeedbacks()
      break
      
    default:
      }
}

// 执行主函数
main().catch((error) => {
  process.exit(1)
})