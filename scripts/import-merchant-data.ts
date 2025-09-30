/**
 * 商家数据导入脚本
 * 
 * 功能：
 * 1. 读取商家数据CSV文件
 * 2. 解析商家分类和基本信息
 * 3. 导入到数据库中
 * 
 * 使用方法：
 * pnpm ts-node scripts/import-merchant-data.ts
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { parse as csvParse } from 'csv-parse'
import { MerchantStatus, BusinessType, ContentType } from '@prisma/client'
import * as dt from '@/lib/utils/date-toolkit'

const prisma = new PrismaClient()

// 商家分类映射
const CATEGORY_MAPPING = {
  '全屋定制工厂': {
    name: '全屋定制工厂',
    description: '专业从事全屋定制家具生产的工厂',
    color: '#10b981',
    icon: 'home-outline',
    keywords: ['全屋定制', '定制', '家具', '工厂', '柜体', '衣柜', '橱柜', '整装', '超市']
  },
  '系统门窗': {
    name: '系统门窗',
    description: '门窗制造、安装和销售商家',
    color: '#3b82f6',
    icon: 'layers-outline',
    keywords: ['门窗', '窗户', '推拉', '平开', '断桥', '铝合金', '封窗', '系统门窗']
  },
  '建材批发': {
    name: '建材批发',
    description: '瓷砖、地板、板材等建材批发商',
    color: '#f59e0b',
    icon: 'cube-outline',
    keywords: ['瓷砖', '地板', '板材', '爱格板', '建材', '材料', '批发', '仓库']
  },
  '卫浴批发': {
    name: '卫浴批发',
    description: '卫浴产品批发和销售商家',
    color: '#06b6d4',
    icon: 'water-outline',
    keywords: ['卫浴', '洁具', '浴室', '马桶', '花洒']
  },
  '窗帘软装': {
    name: '窗帘软装',
    description: '窗帘、布艺等软装产品制造和销售',
    color: '#ec4899',
    icon: 'shirt-outline',
    keywords: ['窗帘', '软装', '布草', '床垫', '布艺']
  },
  '装饰公司': {
    name: '装饰公司',
    description: '装修装饰公司及专业服务提供商',
    color: '#8b5cf6',
    icon: 'construct-outline',
    keywords: ['装饰', '装修', '施工', '设计', '硬装', '工装']
  },
  '机电设备': {
    name: '机电设备',
    description: '空调、机电设备制造和销售商家',
    color: '#ef4444',
    icon: 'settings-outline',
    keywords: ['机电', '空调', '五恒系统', '设备']
  },
  '建筑工程': {
    name: '建筑工程',
    description: '建筑施工、工程承包商家',
    color: '#f97316',
    icon: 'hammer-outline',
    keywords: ['建筑', '工程', '别墅', '自建房', '施工']
  },
  '综合市场': {
    name: '综合市场',
    description: '建材市场、综合性商贸市场',
    color: '#84cc16',
    icon: 'storefront-outline',
    keywords: ['市场', '商贸', '综合', '京鸿基']
  },
  '仓储冷链': {
    name: '仓储冷链',
    description: '冷库、仓储物流服务商家',
    color: '#64748b',
    icon: 'snow-outline',
    keywords: ['冷库', '仓储', '物流']
  },
  '生活用品': {
    name: '生活用品',
    description: '瓷器、生活用品销售商家',
    color: '#a855f7',
    icon: 'cafe-outline',
    keywords: ['瓷器', '生活馆', '用品']
  }
}

// 根据商家名称判断分类
function categorizeByName(merchantName: string): string | null {
  const name = merchantName.toLowerCase()
  
  for (const [categoryKey, categoryInfo] of Object.entries(CATEGORY_MAPPING)) {
    if (categoryInfo.keywords.some(keyword => name.includes(keyword))) {
      return categoryKey
    }
  }
  
  return null
}

// 根据商家名称判断业务类型
function getBusinessType(merchantName: string): BusinessType {
  const name = merchantName.toLowerCase()
  if (name.includes('b端') || name.includes('只做b端') || name.includes('批发')) {
    return BusinessType.B2B
  }
  if (name.includes('b端合作') || name.includes('代工')) {
    return BusinessType.B2B2C
  }
  return BusinessType.B2C
}

// 提取地区信息
function extractLocation(merchantName: string): string | null {
  const locationRegex = /(南宁|广西|桂林|贺州|崇左|钦北防|贵港|武鸣|佛山|武汉|宾阳)/
  const match = merchantName.match(locationRegex)
  return match ? match[1] : null
}

// CSV数据接口
interface CSVRow {
  '商家UID': string
  '﻿商家UID': string // 带BOM的版本
  '商家名称': string
  'collection_time': string
  'id': string
  'desc': string
  'create_time': string
  'text_extra': string
  'nickname': string
  'digg_count': string
  'comment_count': string
  'collect_count': string
  'share_count': string
  'tag': string
  '转录文本': string
  'share_url': string
  'has_transcript': string
  'video_duration': string
  'video_type': string
  'create_timestamp': string
}

// 解析CSV文件
async function parseCSV(filePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const results: CSVRow[] = []
    const parser = csvParse({
      columns: true,
      skip_empty_lines: true,
      encoding: 'utf8',
      relax_column_count: true,
      bom: true // 处理BOM
    })

    parser.on('readable', function() {
      let record
      while (record = parser.read()) {
        // 跳过包含"=== 商家统计信息 ==="的行
        if (record && typeof record === 'object') {
          const firstValue = Object.values(record)[0]
          if (typeof firstValue === 'string' && firstValue.includes('===')) {
            continue
          }
          
          // 获取商家UID和名称（处理BOM）
          const uid = record['商家UID'] || record['﻿商家UID'] || ''
          const name = record['商家名称'] || ''
          
          // 确保记录有效且包含必要字段
          if (uid && name && uid.trim() !== '' && name.trim() !== '') {
            results.push(record as CSVRow)
          }
        }
      }
    })

    parser.on('error', function(err) {
      reject(err)
    })

    parser.on('end', function() {
      resolve(results)
    })

    fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(parser)
  })
}

// 初始化分类数据
async function initializeCategories() {
  for (const [key, categoryInfo] of Object.entries(CATEGORY_MAPPING)) {
    try {
      await prisma.merchantCategory.upsert({
        where: { name: categoryInfo.name },
        update: {
          description: categoryInfo.description,
          color: categoryInfo.color,
          icon: categoryInfo.icon,
        },
        create: {
          name: categoryInfo.name,
          description: categoryInfo.description,
          color: categoryInfo.color,
          icon: categoryInfo.icon,
          sortOrder: Object.keys(CATEGORY_MAPPING).indexOf(key),
        },
      })
    } catch (_error) {
      }
  }
}

// 导入单个商家数据
async function importMerchantData(filePath: string) {
  try {
    const csvData = await parseCSV(filePath)
    
    if (csvData.length === 0) {
      return
    }

    // 从第一条记录获取商家基本信息
    const firstRow = csvData[0]
    const merchantUID = firstRow['商家UID'] || firstRow['﻿商家UID']
    const merchantName = firstRow['商家名称']
    
    if (!merchantUID || !merchantName) {
      console.error(`缺少必要字段(商家UID或商家名称): ${filePath}`)
      return
    }

    // 判断分类
    const categoryName = categorizeByName(merchantName)
    const category = categoryName ? await prisma.merchantCategory.findUnique({
      where: { name: CATEGORY_MAPPING[categoryName as keyof typeof CATEGORY_MAPPING].name }
    }) : null

    // 计算统计数据，避免NaN
    const totalDiggCount = csvData.reduce((sum, row) => {
      const count = parseInt(row['digg_count'] || '0')
      return sum + (isNaN(count) ? 0 : count)
    }, 0)
    
    const totalCommentCount = csvData.reduce((sum, row) => {
      const count = parseInt(row['comment_count'] || '0')
      return sum + (isNaN(count) ? 0 : count)
    }, 0)
    
    const totalCollectCount = csvData.reduce((sum, row) => {
      const count = parseInt(row['collect_count'] || '0')
      return sum + (isNaN(count) ? 0 : count)
    }, 0)
    
    const totalShareCount = csvData.reduce((sum, row) => {
      const count = parseInt(row['share_count'] || '0')
      return sum + (isNaN(count) ? 0 : count)
    }, 0)

    // 创建或更新商家
    const merchant = await prisma.merchant.upsert({
      where: { uid: merchantUID },
      update: {
        name: merchantName,
        location: extractLocation(merchantName),
        businessType: getBusinessType(merchantName),
        lastCollectedAt: new Date(firstRow['collection_time']),
        totalContentCount: csvData.length,
        totalDiggCount,
        totalCommentCount,
        totalCollectCount,
        totalShareCount,
        ...(category && {
          category: {
            connect: { id: category.id }
          }
        })
      },
      create: {
        uid: merchantUID,
        name: merchantName,
        location: extractLocation(merchantName),
        businessType: getBusinessType(merchantName),
        dataSource: 'douyin',
        lastCollectedAt: new Date(firstRow['collection_time']),
        status: MerchantStatus.ACTIVE,
        totalContentCount: csvData.length,
        totalDiggCount,
        totalCommentCount,
        totalCollectCount,
        totalShareCount,
        ...(category && {
          category: {
            connect: { id: category.id }
          }
        })
      },
    })

    // 导入内容数据
    let contentCount = 0
    for (const row of csvData) {
      const externalId = row['id']
      try {
        if (!externalId || externalId.trim() === '') continue

        // 解析时间，处理无效日期
        const createTimeStr = row['create_time']
        const createTime = createTimeStr && createTimeStr.trim() !== '' ? new Date(createTimeStr) : null
        const validCreateTime = createTime && !isNaN(createTime.getTime()) ? createTime : null

        const collectedTimeStr = row['collection_time']
        const collectedTime = collectedTimeStr ? new Date(collectedTimeStr) : dt.now()
        const validCollectedTime = !isNaN(collectedTime.getTime()) ? collectedTime : dt.now()

        // 安全解析数字，避免NaN
        const safeParseInt = (value: string | undefined): number => {
          const parsed = parseInt(value || '0')
          return isNaN(parsed) ? 0 : parsed
        }

        await prisma.merchantContent.upsert({
          where: {
            externalId_merchantId: {
              externalId: externalId,
              merchantId: merchant.id
            }
          },
          update: {
            title: row['desc'] || '',
            transcript: row['转录文本'] || null,
            duration: row['video_duration'] || null,
            shareUrl: row['share_url'] || null,
            hasTranscript: row['has_transcript'] === 'True',
            diggCount: safeParseInt(row['digg_count']),
            commentCount: safeParseInt(row['comment_count']),
            collectCount: safeParseInt(row['collect_count']),
            shareCount: safeParseInt(row['share_count']),
            tags: row['tag'] || '[]',
            textExtra: row['text_extra'] || '[]',
            publishedAt: validCreateTime,
            collectedAt: validCollectedTime,
          },
          create: {
            externalId: externalId,
            merchantId: merchant.id,
            title: row['desc'] || '',
            transcript: row['转录文本'] || null,
            contentType: row['video_type'] === '视频' ? ContentType.VIDEO : ContentType.OTHER,
            duration: row['video_duration'] || null,
            shareUrl: row['share_url'] || null,
            hasTranscript: row['has_transcript'] === 'True',
            diggCount: safeParseInt(row['digg_count']),
            commentCount: safeParseInt(row['comment_count']),
            collectCount: safeParseInt(row['collect_count']),
            shareCount: safeParseInt(row['share_count']),
            tags: row['tag'] || '[]',
            textExtra: row['text_extra'] || '[]',
            publishedAt: validCreateTime,
            collectedAt: validCollectedTime,
          },
        })
        contentCount++
      } catch (error) {
        console.error(`创建商家内容失败:`, error)
      }
    }

    return { merchantName, contentCount }
    
  } catch (error) {
    console.error(`处理文件时出错:`, error)
    return null
  }
}

// 主函数
async function main() {
  try {
    // 初始化分类
    await initializeCategories()
    
    const dataDir = path.join(process.cwd(), '商家聚合数据')
    const files = fs.readdirSync(dataDir)
    const csvFiles = files.filter(file => file.endsWith('.csv'))
    
    const results = []
    for (const csvFile of csvFiles) {
      const filePath = path.join(dataDir, csvFile)
      const result = await importMerchantData(filePath)
      if (result) {
        results.push(result)
      }
    }
    
    console.info(`导入完成！共处理 ${results.length} 个商家，${results.reduce((sum, r) => sum + r.contentCount, 0)} 条内容`)
    
    // 统计信息
    const categories = await prisma.merchantCategory.findMany({
      include: {
        _count: {
          select: { merchants: true }
        }
      }
    })
    
    categories.forEach(category => {
      })
    
  } catch (_error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行脚本
if (require.main === module) {
  main()
}

export { main as importMerchantData }