// 文档管理模拟数据

export interface MockDocument {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  version: number
  wordCount: number
  status: 'draft' | 'published' | 'archived'
  author: string
  aiGenerated?: boolean
}

const categories = ["短视频文案", "营销文案", "产品介绍", "教程内容", "创意脚本"]
const statuses = ["draft", "published", "archived"] as const

const documentTitles = [
  "美食探店短视频文案 - 网红餐厅打卡",
  "旅行攻略文案 - 三亚自由行完整指南",
  "科技产品评测 - 最新智能手机深度体验",
  "时尚穿搭教程 - 秋季搭配完全指南",
  "健身训练计划 - 居家健身15分钟方案",
  "美妆教程文案 - 日常妆容步骤详解",
  "生活技巧分享 - 收纳整理实用方法",
  "宠物护理指南 - 新手养猫注意事项",
  "投资理财入门 - 基金定投策略分析",
  "职场技能提升 - 高效沟通技巧分享",
  "家居装修灵感 - 小户型空间利用",
  "育儿经验分享 - 幼儿教育心得体会",
  "摄影技巧教学 - 手机拍照构图法则",
  "烹饪教程文案 - 家常菜制作全过程",
  "读书笔记整理 - 个人成长类书籍推荐",
]

const documentContents = [
  "今天要给大家推荐一家超级好吃的网红餐厅！这家店的招牌菜真的是绝了，每一口都让人回味无穷。店内装修也很有特色，非常适合拍照打卡。服务态度也很棒，服务员小姐姐都很热情。价格也很合理，性价比超高！强烈推荐大家去试试，记得提前预约哦！",
  "三亚自由行攻略来啦！首先是交通，建议大家选择飞机直达，时间短效率高。住宿推荐海边的度假酒店，可以直接看海景。必去景点包括天涯海角、南山寺、亚龙湾等。美食方面一定要尝试海鲜大餐和椰子鸡。记得带好防晒用品，三亚的阳光可是很毒的！",
  "这款新手机的性能真的让我惊艳！处理器升级明显，运行大型游戏毫无压力。拍照功能也有很大提升，夜景模式特别出色。电池续航能力很强，重度使用一天完全没问题。外观设计也很时尚，手感很棒。总的来说，这是一款值得推荐的产品！",
]

const allTags = ["热门", "原创", "教程", "攻略", "评测", "推荐", "实用", "创意", "趋势", "专业"]

export function generateMockDocuments(): MockDocument[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `doc_${i + 1}`,
    title: documentTitles[i % documentTitles.length],
    content: generateDocumentContent(i),
    category: categories[i % categories.length],
    tags: generateTags(i),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    version: Math.floor(Math.random() * 5) + 1,
    wordCount: Math.floor(Math.random() * 500) + 100,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    author: `创作者${(i % 3) + 1}`,
    aiGenerated: Math.random() > 0.3,
  }))
}

function generateDocumentContent(index: number): string {
  const baseContent = documentContents[index % documentContents.length]
  return baseContent + " 这是AI生成的示例内容，实际使用时会根据用户需求进行个性化创作。"
}

function generateTags(index: number): string[] {
  const numTags = Math.floor(Math.random() * 4) + 2
  return allTags.slice(index % 6, (index % 6) + numTags)
}