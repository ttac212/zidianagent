/**
 * TikHub API 垂类内容标签测试脚本
 *
 * 测试 TikHub API 的垂类内容标签接口
 * 端点: /api/v1/douyin/billboard/fetch_content_tag
 *
 * 使用方法:
 * npx tsx scripts/test-content-tags.ts
 * npx tsx scripts/test-content-tags.ts --search=美食
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { ContentTag } from '@/lib/tikhub/types'

/**
 * 递归统计标签总数（包括所有子标签）
 */
function countTotalTags(tags: ContentTag[]): number {
  let count = tags.length
  tags.forEach((tag) => {
    if (tag.children && tag.children.length > 0) {
      count += countTotalTags(tag.children)
    }
  })
  return count
}

/**
 * 递归打印标签树
 */
function printTagTree(tags: ContentTag[], prefix = '', isLast = true, maxDepth = 2, currentDepth = 0) {
  if (currentDepth >= maxDepth) return

  tags.forEach((tag, index) => {
    const isLastItem = index === tags.length - 1
    const connector = isLastItem ? '└─' : '├─'
    const childPrefix = isLastItem ? '   ' : '│  '

    console.log(`${prefix}${connector} ${tag.label} (ID: ${tag.value})`)

    if (tag.children && tag.children.length > 0) {
      const childCount = tag.children.length
      const showCount = Math.min(childCount, 5)

      // 显示前5个子标签
      printTagTree(
        tag.children.slice(0, showCount),
        prefix + childPrefix,
        false,
        maxDepth,
        currentDepth + 1
      )

      // 如果有更多子标签，显示省略提示
      if (childCount > showCount) {
        console.log(`${prefix}${childPrefix}   ... 还有 ${childCount - showCount} 个子标签`)
      }
    }
  })
}

/**
 * 搜索标签（递归）
 */
function searchTags(tags: ContentTag[], keyword: string, results: ContentTag[] = []): ContentTag[] {
  tags.forEach((tag) => {
    if (tag.label.includes(keyword)) {
      results.push(tag)
    }
    if (tag.children && tag.children.length > 0) {
      searchTags(tag.children, keyword, results)
    }
  })
  return results
}

/**
 * 构建查询参数示例
 */
function buildQueryTagExample(tag: ContentTag): string {
  if (!tag.children || tag.children.length === 0) {
    return JSON.stringify({ value: tag.value })
  }

  return JSON.stringify({
    value: tag.value,
    children: tag.children.map((child) => ({ value: child.value })),
  })
}

/**
 * 测试获取垂类内容标签
 */
async function testGetContentTags() {
  console.log('=== 测试获取垂类内容标签 ===\n')

  try {
    // 创建客户端时显式传递配置
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log('正在获取垂类内容标签...\n')
    const response = await client.getContentTags()

    // 检查响应数据
    if (!response || !response.data || !Array.isArray(response.data)) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const tags = response.data
    console.log(`✅ 成功获取垂类内容标签`)

    // 统计信息
    const topLevelCount = tags.length
    const totalCount = countTotalTags(tags)
    console.log(`顶级标签数量: ${topLevelCount}`)
    console.log(`标签总数: ${totalCount} (包括所有子标签)\n`)

    // 显示标签树（前10个顶级标签）
    console.log('=== 垂类标签树（前10个顶级标签，最多显示2层）===\n')
    const displayTags = tags.slice(0, 10)
    printTagTree(displayTags, '', true, 2, 0)

    if (tags.length > 10) {
      console.log(`\n... 还有 ${tags.length - 10} 个顶级标签`)
    }

    // 显示查询参数构建示例
    console.log('\n=== 查询参数构建示例 ===\n')
    if (tags.length > 0) {
      const exampleTag = tags.find((t) => t.children && t.children.length > 0) || tags[0]
      console.log(`标签: ${exampleTag.label} (ID: ${exampleTag.value})`)
      if (exampleTag.children && exampleTag.children.length > 0) {
        console.log(`子标签数量: ${exampleTag.children.length}`)
        console.log(`\n查询参数 (包含所有子标签):`)
        console.log(buildQueryTagExample(exampleTag))
      } else {
        console.log(`\n查询参数:`)
        console.log(buildQueryTagExample(exampleTag))
      }
      console.log()
    }

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './content-tags-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          topLevelCount,
          totalCount,
          data: response,
        },
        null,
        2
      )
    )
    console.log(`📄 完整数据已保存到: ${outputPath}\n`)

    return true
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.details) {
      console.error('详细信息:', JSON.stringify(error.details, null, 2))
    }
    return false
  }
}

/**
 * 测试搜索特定标签
 */
async function testSearchTag(tagName: string) {
  console.log(`=== 搜索标签: "${tagName}" ===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const response = await client.getContentTags()

    if (!response || !response.data || !Array.isArray(response.data)) {
      console.error('❌ 无法获取标签列表')
      return false
    }

    const matchedTags = searchTags(response.data, tagName)

    if (matchedTags.length === 0) {
      console.log(`⚠️  未找到包含"${tagName}"的标签`)
      return true
    }

    console.log(`找到 ${matchedTags.length} 个匹配的标签:\n`)
    matchedTags.forEach((tag, index) => {
      console.log(`${index + 1}. ${tag.label}`)
      console.log(`   标签ID: ${tag.value}`)
      if (tag.children && tag.children.length > 0) {
        console.log(`   子标签数量: ${tag.children.length}`)
        console.log(`   子标签: ${tag.children.map((c) => c.label).join(', ')}`)
        console.log(`\n   查询参数示例:`)
        console.log(`   ${buildQueryTagExample(tag)}`)
      } else {
        console.log(`   查询参数: {"value": ${tag.value}}`)
      }
      console.log()
    })

    return true
  } catch (error: any) {
    console.error('❌ 搜索失败:', error.message)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API - 垂类内容标签测试工具            ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 检查命令行参数
  const args = process.argv.slice(2)
  const searchTag = args.find((arg) => arg.startsWith('--search='))?.split('=')[1]

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (searchTag) {
    // 如果指定了搜索参数，只执行搜索
    tests.push({
      name: `搜索标签: ${searchTag}`,
      fn: () => testSearchTag(searchTag),
    })
  } else {
    // 否则执行完整测试
    tests.push({
      name: '获取垂类内容标签',
      fn: testGetContentTags,
    })
  }

  const results: Array<{ name: string; passed: boolean }> = []

  for (const test of tests) {
    const passed = await test.fn()
    results.push({ name: test.name, passed })

    // 每个测试之间延迟500ms
    if (tests.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // 输出测试摘要
  if (results.length > 1) {
    console.log('\n╔══════════════════════════════════════════════════╗')
    console.log('║              测试结果摘要                        ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    results.forEach(({ name, passed }) => {
      const status = passed ? '✅ 通过' : '❌ 失败'
      console.log(`${name.padEnd(30)} ${status}`)
    })

    const totalPassed = results.filter((r) => r.passed).length
    const totalTests = results.length

    console.log(`\n总计: ${totalPassed}/${totalTests} 测试通过`)

    if (totalPassed === totalTests) {
      console.log('\n🎉 所有测试通过！\n')
    } else {
      console.log('\n⚠️  部分测试失败，请检查错误信息。\n')
    }
  }
}

// 运行测试
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('测试运行失败:', error)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}

export { testGetContentTags, testSearchTag }
