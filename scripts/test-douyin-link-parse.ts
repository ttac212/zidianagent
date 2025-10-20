/**
 * 测试抖音链接解析功能
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'

async function testValidLink() {
  console.log('\n=== 测试: 有效的抖音分享链接 ===')

  const testUrl = process.env.TEST_SHARE_URL || 'https://v.douyin.com/Y6p-Hsws68c/'

  try {
    console.log('测试URL:', testUrl)
    const result = await parseDouyinVideoShare(testUrl)
    console.log('\n✓ 解析成功!')
    console.log('原始URL:', result.originalUrl)
    console.log('解析后URL:', result.resolvedUrl)
    console.log('视频ID:', result.videoId)
    console.log('用户ID:', result.userId)
    console.log('SecUserID:', result.secUserId)
  } catch (error) {
    if (error instanceof Error) {
      console.error('✗ 解析失败:', error.message)
      console.error('错误堆栈:', error.stack)
    }
  }
}

async function main() {
  console.log('开始测试抖音链接解析...\n')
  await testValidLink()
  console.log('\n测试完成!')
}

main().catch(console.error)
