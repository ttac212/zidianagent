/**
 * 商家数据导出API路由
 * GET /api/merchants/[id]/export - 导出商家数据为CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { parseAndCleanTags } from '@/lib/utils/tag-parser'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'

// GET /api/merchants/[id]/export - 导出商家数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const _format = searchParams.get('format') || 'csv' // TODO: 实现格式选择功能
    const type = searchParams.get('type') || 'content' // content | analytics | tags
    
    if (!id) {
      return NextResponse.json(
        { error: '商家ID不能为空' },
        { status: 400 }
      )
    }

    // 获取商家及其内容
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          }
        }
      }
    })

    if (!merchant) {
      return NextResponse.json(
        { error: '商家不存在' },
        { status: 404 }
      )
    }

    let csvContent = ''
    let filename = ''

    if (type === 'content') {
      // 导出内容数据
      filename = `${merchant.name}_内容数据_${new Date().toISOString().split('T')[0]}.csv`
      
      // CSV 头部
      const headers = [
        '内容ID',
        '标题',
        '内容类型',
        '发布时间',
        '时长',
        '点赞数',
        '评论数',
        '收藏数',
        '分享数',
        '互动评分',
        '标签',
        '是否有转录',
        '分享链接'
      ]
      
      csvContent = headers.join(',') + '\n'
      
      // 内容数据行
      merchant.contents.forEach(content => {
        const engagementScore = content.diggCount + content.commentCount * 2 + 
                               content.collectCount * 3 + content.shareCount * 4
        
        const tags = parseAndCleanTags(content.tags).join(';')
        
        const row = [
          content.externalId,
          `"${(content.title || '').replace(/"/g, '""')}"`,
          content.contentType,
          content.publishedAt ? content.publishedAt.toISOString().split('T')[0] : '',
          content.duration || '',
          content.diggCount,
          content.commentCount,
          content.collectCount,
          content.shareCount,
          engagementScore,
          `"${tags.replace(/"/g, '""')}"`,
          content.hasTranscript ? '是' : '否',
          content.shareUrl || ''
        ]
        
        csvContent += row.join(',') + '\n'
      })
    } else if (type === 'analytics') {
      // 导出分析数据
      filename = `${merchant.name}_分析数据_${new Date().toISOString().split('T')[0]}.csv`
      
      // 计算分析数据
      const totalEngagement = merchant.totalDiggCount + merchant.totalCommentCount + 
                             merchant.totalCollectCount + merchant.totalShareCount
      const avgEngagement = merchant.totalContentCount > 0 ? 
                            Math.round(totalEngagement / merchant.totalContentCount) : 0
      
      const videoCount = merchant.contents.filter(c => c.contentType === 'VIDEO').length
      const withTranscript = merchant.contents.filter(c => c.hasTranscript).length
      
      // CSV 内容
      const analyticsData = [
        ['指标', '数值', '说明'],
        ['商家名称', `"${merchant.name}"`, ''],
        ['商家分类', merchant.category?.name || '未分类', ''],
        ['业务类型', merchant.businessType, ''],
        ['所在地区', merchant.location || '未指定', ''],
        ['', '', ''], // 空行
        ['内容统计', '', ''],
        ['总内容数', merchant.totalContentCount.toString(), ''],
        ['视频内容数', videoCount.toString(), ''],
        ['其他内容数', (merchant.totalContentCount - videoCount).toString(), ''],
        ['带转录内容', withTranscript.toString(), ''],
        ['转录覆盖率', `${Math.round((withTranscript / merchant.totalContentCount) * 100)}%`, ''],
        ['', '', ''], // 空行
        ['互动统计', '', ''],
        ['总点赞数', merchant.totalDiggCount.toString(), ''],
        ['总评论数', merchant.totalCommentCount.toString(), ''],
        ['总收藏数', merchant.totalCollectCount.toString(), ''],
        ['总分享数', merchant.totalShareCount.toString(), ''],
        ['总互动量', totalEngagement.toString(), ''],
        ['平均互动量', avgEngagement.toString(), '每条内容平均'],
        ['', '', ''], // 空行
        ['时间信息', '', ''],
        ['创建时间', merchant.createdAt.toISOString().split('T')[0], ''],
        ['最后采集时间', merchant.lastCollectedAt ? merchant.lastCollectedAt.toISOString().split('T')[0] : '', '']
      ]
      
      csvContent = analyticsData.map(row => row.join(',')).join('\n')
    } else if (type === 'tags') {
      // 导出标签数据
      filename = `${merchant.name}_标签数据_${new Date().toISOString().split('T')[0]}.csv`
      
      // 统计标签
      const tagMap = new Map<string, { count: number; engagementSum: number }>()
      
      merchant.contents.forEach(content => {
        const tags = parseAndCleanTags(content.tags)
        const engagement = content.diggCount + content.commentCount + 
                          content.collectCount + content.shareCount
        
        tags.forEach(tag => {
          const cleanTag = tag.toLowerCase()
          const existing = tagMap.get(cleanTag) || { count: 0, engagementSum: 0 }
          tagMap.set(cleanTag, {
            count: existing.count + 1,
            engagementSum: existing.engagementSum + engagement
          })
        })
      })
      
      const tagStats = Array.from(tagMap.entries())
        .map(([tag, stats]) => ({
          tag,
          count: stats.count,
          engagementSum: stats.engagementSum,
          avgEngagement: Math.round(stats.engagementSum / stats.count)
        }))
        .sort((a, b) => b.count - a.count)
      
      // CSV 头部和数据
      const headers = ['标签', '使用次数', '总互动量', '平均互动量']
      csvContent = headers.join(',') + '\n'
      
      tagStats.forEach(tag => {
        const row = [
          `"${tag.tag.replace(/"/g, '""')}"`,
          tag.count,
          tag.engagementSum,
          tag.avgEngagement
        ]
        csvContent += row.join(',') + '\n'
      })
    }

    // 添加UTF-8 BOM解决中文乱码问题
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent
    
    // 设置响应头
    const response = new NextResponse(csvWithBOM, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      }
    })

    return response
    
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'