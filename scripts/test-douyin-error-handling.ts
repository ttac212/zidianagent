/**
 * 测试抖音处理管道的错误处理
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { runDouyinPipeline } from '@/lib/douyin/pipeline'

async function testParseError() {
  console.log('\n=== 测试1: 无效链接格式 ===')
  try {
    await parseDouyinVideoShare('这是一段不包含任何抖音链接的文本')
  } catch (error) {
    if (error instanceof Error) {
      console.log('✓ 错误消息:', error.message)
    }
  }
}

async function testShortCodeError() {
  console.log('\n=== 测试2: 纯短代码格式 ===')
  try {
    await parseDouyinVideoShare('2.84 dan:/ 12/24 复制打开抖音')
  } catch (error) {
    if (error instanceof Error) {
      console.log('✓ 错误消息:', error.message)
    }
  }
}

async function testPipelineWithInvalidLink() {
  console.log('\n=== 测试3: Pipeline处理无效链接 ===')
  try {
    await runDouyinPipeline(
      '测试无效链接',
      async (event) => {
        console.log(`事件: ${event.type}`, event)
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      console.log('✓ 错误类型:', error.name)
      console.log('✓ 错误消息:', error.message)
    }
  }
}

async function main() {
  console.log('开始测试抖音错误处理...\n')

  await testParseError()
  await testShortCodeError()
  await testPipelineWithInvalidLink()

  console.log('\n测试完成!')
}

main().catch(console.error)
