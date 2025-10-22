// 加载环境变量
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub/client'
import { parseDouyinVideoShare } from '@/lib/douyin/share-link'

// 测试链接
const TEST_SHARE_LINK = `本地，80㎡以上的房子装修要多少钱？输入面积，免费获取报价#左小青隐藏的装修主理人#创艺装饰 https://v.douyin.com/fObbpu9fOfk/ 复制此链接，打开【抖音】，直接观看视频！`

/**
 * 清理评论文本中的表情符号
 * 删除所有 [xxx] 格式的内容
 */
function cleanCommentText(text: string): string {
  return text.replace(/\[.*?\]/g, '').trim()
}

/**
 * 调用LLM分析评论数据
 */
async function analyzWithLLM(data: any): Promise<string> {
  const apiKey = process.env.LLM_API_KEY || process.env.LLM_CLAUDE_API_KEY
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

  if (!apiKey) {
    throw new Error('LLM_API_KEY未设置')
  }

  // 构建分析提示词
  const prompt = `请分析以下抖音视频的评论数据，给出专业的洞察报告：

**视频信息**
- 标题: ${data.video.title}
- 作者: ${data.video.author}
- 播放量: ${data.statistics.play_count?.toLocaleString('zh-CN')}
- 点赞数: ${data.statistics.digg_count?.toLocaleString('zh-CN')}
- 评论总数: ${data.comments.length}条样本

**评论样本**
${data.comments.map((c: any, i: number) => {
  const location = c.location ? ` [${c.location}]` : ''
  return `${i + 1}. ${c.user}${location}: ${c.text}`
}).join('\n')}

**地域分布**
${data.locationStats.map(([loc, count]: [string, number]) => `- ${loc}: ${count}条`).join('\n')}

请按以下维度分析：

1. **用户情感倾向分析**
   - 正面/负面/中性比例
   - 整体情感得分

2. **核心关注点（按权重排序）**
   - 用户最关心的3-5个话题
   - 每个话题的关注度（高/中/低）

3. **具体需求分析**
   - 用户询问的具体问题
   - 明确表达的需求

4. **用户画像**
   - 地域分布特征及分析
   - 用户特征（身份、年龄层、消费能力推测）
   - 消费心理（价格敏感度、决策因素）

5. **潜在问题或改进建议**
   - 用户反馈的问题
   - 可优化的方向

请用中文简洁地输出分析结果，使用markdown格式。`

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API错误: ${response.status} - ${error}`)
  }

  const result = await response.json()
  return result.choices[0].message.content
}

async function main() {
  console.log('='.repeat(80))
  console.log('抖音视频数据分析')
  console.log('='.repeat(80))
  console.log()

  try {
    // 步骤1: 解析链接
    console.log('【1】解析链接...')
    const parseResult = await parseDouyinVideoShare(TEST_SHARE_LINK)
    console.log(`✅ 视频ID: ${parseResult.videoId}`)
    console.log()

    if (!parseResult.videoId) {
      throw new Error('无法提取视频ID')
    }

    // 步骤2: 初始化客户端
    if (!process.env.TIKHUB_API_KEY) {
      throw new Error('TIKHUB_API_KEY环境变量未设置')
    }

    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    // 步骤3: 获取视频信息
    console.log('【2】获取视频信息...')
    const videoDetail = await client.getVideoDetail({
      aweme_id: parseResult.videoId,
    })

    let videoInfo: any = null
    if (videoDetail?.aweme_detail) {
      const video = videoDetail.aweme_detail
      videoInfo = {
        awemeId: video.aweme_id,
        title: video.desc,
        author: video.author.nickname,
        createTime: video.create_time,
        duration: video.video.duration,
        statistics: video.statistics,
      }

      console.log(`标题: ${video.desc}`)
      console.log(`作者: ${video.author.nickname}`)
      console.log(`时长: ${Math.round(video.video.duration / 1000)}秒`)
      console.log()
    }

    // 步骤4: 获取播放数据
    console.log('【3】获取播放数据...')
    const statistics = await client.getVideoStatistics({
      aweme_ids: parseResult.videoId,
    })

    const statisticsList =
      statistics.statistics ?? (statistics as { statistics_list?: typeof statistics.statistics }).statistics_list ?? []

    if (statisticsList.length > 0) {
      const stats = statisticsList[0]
      console.log(`📺 播放量: ${stats.play_count.toLocaleString('zh-CN')}`)
      console.log(`👍 点赞数: ${stats.digg_count.toLocaleString('zh-CN')}`)
      console.log(`💬 评论数: ${videoInfo?.statistics?.comment_count?.toLocaleString('zh-CN') || 'N/A'}`)
      console.log(`📤 分享数: ${stats.share_count.toLocaleString('zh-CN')}`)
      console.log()
    }

    // 步骤5: 获取评论数据
    console.log('【4】获取评论数据...')
    const commentsPage1 = await client.getVideoComments({
      aweme_id: parseResult.videoId,
      cursor: 0,
      count: 20,
    })

    console.log(`评论总数: ${commentsPage1.total}`)

    // 收集评论用于LLM分析
    let allComments: any[] = []
    if (commentsPage1.comments) {
      allComments = [...commentsPage1.comments]
    }

    // 继续获取更多评论（最多100条）
    if (commentsPage1.has_more && commentsPage1.comments && commentsPage1.comments.length > 0) {
      let cursor = commentsPage1.cursor
      let pageCount = 1
      const maxPages = 5

      while (pageCount < maxPages && cursor) {
        try {
          const nextPage = await client.getVideoComments({
            aweme_id: parseResult.videoId,
            cursor: cursor,
            count: 20,
          })

          if (nextPage.comments && nextPage.comments.length > 0) {
            allComments.push(...nextPage.comments)
            pageCount++
          }

          if (!nextPage.has_more) break
          cursor = nextPage.cursor

          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          break
        }
      }
    }
    console.log(`已采集: ${allComments.length}条`)
    console.log()

    // 准备LLM分析数据
    console.log('【5】准备分析数据...')
    console.log()

    // 清理评论文本，删除表情符号，并收集地域信息
    const locationMap = new Map<string, number>()
    const cleanedComments = allComments.slice(0, 50).map(c => {
      const cleanText = cleanCommentText(c.text)
      // 过滤掉清理后为空或太短的评论
      if (!cleanText || cleanText.length < 2) return null

      // 统计地域分布
      if (c.ip_label) {
        locationMap.set(c.ip_label, (locationMap.get(c.ip_label) || 0) + 1)
      }

      return {
        user: c.user.nickname,
        text: cleanText,
        likes: c.digg_count,
        location: c.ip_label || '',
      }
    }).filter(c => c !== null)

    // 按地域统计排序
    const locationStats = Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    const analysisData = {
      video: {
        title: videoInfo?.title || '',
        author: videoInfo?.author || '',
      },
      statistics: statisticsList[0] || {},
      comments: cleanedComments,
      locationStats,
    }

    console.log('='.repeat(80))
    console.log('LLM分析提示')
    console.log('='.repeat(80))
    console.log()
    console.log('请分析以下抖音视频的评论数据：')
    console.log()
    console.log(`视频: ${analysisData.video.title}`)
    console.log(`作者: ${analysisData.video.author}`)
    console.log(`播放: ${analysisData.statistics.play_count?.toLocaleString('zh-CN')}`)
    console.log(`点赞: ${analysisData.statistics.digg_count?.toLocaleString('zh-CN')}`)
    console.log()
    console.log(`评论样本 (${cleanedComments.length}条):`)
    cleanedComments.slice(0, 20).forEach((c, i) => {
      const location = c.location ? ` [${c.location}]` : ''
      console.log(`${i + 1}. ${c.user}${location}: ${c.text}`)
    })
    console.log()
    if (locationStats.length > 0) {
      console.log('地域分布:')
      locationStats.forEach(([location, count]) => {
        console.log(`- ${location}: ${count}条`)
      })
      console.log()
    }
    console.log('分析要求:')
    console.log('1. 用户情感倾向分析（正面/负面/中性比例）')
    console.log('2. 用户主要关注点（核心关注按权重排序）')
    console.log('3. 具体需求分析（用户询问的具体问题）')
    console.log('4. 用户画像:')
    console.log('   - 地域分布特征')
    console.log('   - 用户特征（身份、年龄层推测）')
    console.log('   - 消费心理（价格敏感度、决策因素）')
    console.log('5. 潜在问题或改进建议')
    console.log()

    // 调用LLM进行分析
    console.log('='.repeat(80))
    console.log('正在调用LLM分析...')
    console.log('='.repeat(80))
    console.log()

    try {
      const llmResponse = await analyzWithLLM(analysisData)
      console.log(llmResponse)
      console.log()
    } catch (error: any) {
      console.log('⚠️  LLM分析失败:', error.message)
      console.log('请手动将上述数据提供给LLM进行分析')
      console.log()
    }

    console.log('='.repeat(80))
    console.log('✅ 完成')
    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('\n❌ 错误:', error.message)
    if (error.code) {
      console.error('错误代码:', error.code)
    }
    process.exit(1)
  }
}

// 运行测试
main()
