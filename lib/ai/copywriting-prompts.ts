/**
 * 文案生成 Prompt 模板
 * 简单、直接、有效
 */

import { Merchant, MerchantContent, MerchantCategory } from "@prisma/client"

export interface CopywritingContext {
  merchant: Merchant & {
    contents?: MerchantContent[]
    category?: MerchantCategory | null
  }
  userRequest?: string // 用户的特殊要求
  previousVersions?: any[] // 之前生成的版本（用于迭代）
}

/**
 * 构建文案生成的System Prompt
 */
export function buildCopywritingSystemPrompt(): string {
  return `你是一位专业的短视频文案创作专家，擅长根据商家数据生成吸引人的营销文案。

核心能力：
1. 数据驱动：基于真实的商家信息和热门内容数据
2. 风格多样：能生成专业型、活泼型、促销型等不同风格
3. 合规意识：符合广告法，不使用"最好"、"第一"、"唯一"等绝对化用语
4. 结构清晰：每个文案包含标题、正文、行动号召（CTA）

输出格式要求：
必须返回JSON格式，包含3个不同风格的文案版本：
{
  "versions": [
    {
      "style": "professional", // 风格：professional/casual/promotional
      "title": "吸引人的标题（15-30字）",
      "body": "正文内容（150-300字，分2-3段）",
      "cta": "行动号召（简短有力）",
      "highlights": ["卖点1", "卖点2", "卖点3"] // 核心卖点
    },
    // ... 另外两个版本
  ]
}

创作原则：
- 数据准确：使用提供的真实商家数据，不编造
- 语言流畅：口语化表达，避免生硬
- 吸引眼球：标题和开头要能抓住注意力
- 明确CTA：告诉用户下一步该做什么`
}

/**
 * 构建文案生成的User Prompt
 */
export function buildCopywritingUserPrompt(context: CopywritingContext): string {
  const { merchant, userRequest, previousVersions } = context

  // 1. 商家基本信息
  let prompt = `商家信息：
- 名称：${merchant.name}
- 分类：${merchant.category?.name || "未知"}
- 业务类型：${merchant.businessType || "B2C"}
- 地区：${merchant.location || "未知"}
- 简介：${merchant.description || "无"}
`

  // 2. 热门内容数据
  if (merchant.contents && merchant.contents.length > 0) {
    prompt += `\n热门内容（按互动量排序）：\n`
    merchant.contents.slice(0, 10).forEach((content, index) => {
      const engagement = content.diggCount + content.commentCount
      prompt += `${index + 1}. ${content.title}（${content.diggCount}赞 ${content.commentCount}评论）\n`
    })
  }

  // 3. 标签和主题（从热门内容的tags字段中提取）
  if (merchant.contents && merchant.contents.length > 0) {
    const allTags: string[] = []

    merchant.contents.forEach(content => {
      try {
        const parsed = JSON.parse(content.tags || '[]')
        if (Array.isArray(parsed)) {
          allTags.push(...parsed.filter((tag: any): tag is string => typeof tag === 'string'))
        }
      } catch {
        // tags字段解析失败，跳过
      }
    })

    if (allTags.length > 0) {
      // 去重并取前10个
      const uniqueTags = Array.from(new Set(allTags)).slice(0, 10)
      prompt += `\n常用标签：${uniqueTags.join("、")}\n`
    }
  }

  // 4. 用户的特殊要求
  if (userRequest) {
    prompt += `\n用户要求：${userRequest}\n`
  }

  // 5. 之前的版本（用于迭代改进）
  if (previousVersions && previousVersions.length > 0) {
    prompt += `\n之前生成的版本（供参考）：\n`
    previousVersions.forEach((v, i) => {
      prompt += `版本${i + 1}（${v.style}）：${v.title}\n`
    })
    prompt += `\n请基于上述版本进行改进或生成新的风格。\n`
  }

  // 6. 任务说明
  if (!previousVersions || previousVersions.length === 0) {
    prompt += `\n任务：
请生成3个不同风格的短视频文案：
1. **专业型**：突出品质、工艺、专业能力，适合企业客户
2. **活泼型**：贴近生活、幽默风趣，适合年轻消费者
3. **促销型**：强调优惠、限时活动，驱动立即行动

要求：
- 每个文案150-300字
- 标题要吸引眼球
- 正文要融入上面的真实数据（如互动量、热门内容主题）
- CTA要简短有力
- 输出JSON格式（严格按照system prompt的格式）
`
  } else {
    prompt += `\n请根据用户要求生成新的文案版本（JSON格式）。\n`
  }

  return prompt
}

/**
 * 检测用户消息是否是文案生成请求
 */
export function isCopywritingRequest(message: string): boolean {
  const keywords = [
    "生成文案",
    "写文案",
    "创作文案",
    "短视频文案",
    "营销文案",
    "文案创作",
    "/文案", // 斜杠命令
    "帮我写",
    "帮我生成",
  ]

  return keywords.some(keyword => message.includes(keyword))
}

/**
 * 从用户消息中提取商家ID或名称
 */
export function extractMerchantInfo(message: string): {
  merchantId?: string
  merchantName?: string
} {
  // 尝试提取商家ID（格式：clxxx...）
  const idMatch = message.match(/cl[a-z0-9]{24,}/i)
  if (idMatch) {
    return { merchantId: idMatch[0] }
  }

  // 尝试提取商家名称（用引号包裹）
  const nameMatch = message.match(/[「『"'"](.*?)[」』"'"]/g)
  if (nameMatch && nameMatch.length > 0) {
    return { merchantName: nameMatch[0].replace(/[「『"'"」』]/g, "") }
  }

  // 尝试提取"XX商家"、"XX店"等模式
  const patternMatch = message.match(/([\u4e00-\u9fa5]{2,})(?:商家|店铺|工厂|公司|品牌)/g)
  if (patternMatch && patternMatch.length > 0) {
    return { merchantName: patternMatch[0].replace(/(商家|店铺|工厂|公司|品牌)/, "") }
  }

  return {}
}

/**
 * 检测是否是文案修改请求
 */
export function isCopywritingEditRequest(message: string): {
  isEdit: boolean
  versionIndex?: number // 0-based
  editInstruction?: string
} {
  const lowerMessage = message.toLowerCase()

  // 检测版本号
  let versionIndex: number | undefined
  const versionMatch = message.match(/(?:第|版本)?([一二三1-3])(?:个|版)?/)
  if (versionMatch) {
    const versionStr = versionMatch[1]
    const versionMap: Record<string, number> = { "一": 0, "二": 1, "三": 2, "1": 0, "2": 1, "3": 2 }
    versionIndex = versionMap[versionStr]
  }

  // 检测修改意图
  const editKeywords = ["改", "修改", "调整", "优化", "换个", "再来"]
  const isEdit = editKeywords.some(keyword => message.includes(keyword))

  if (isEdit) {
    return {
      isEdit: true,
      versionIndex,
      editInstruction: message
    }
  }

  return { isEdit: false }
}
