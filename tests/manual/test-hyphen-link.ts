import { parseDouyinVideoShare } from '../../lib/douyin/share-link'

const testText = '在本地，手表走时不准维修需要多少钱？输入手表品牌获取报价 https://v.douyin.com/KYgiZhqu-w8/ 复制此链接，打开【抖音】，直接观看视频！'

console.log('测试包含连字符的抖音链接解析\n')
console.log('输入文本:', testText)
console.log('\n开始解析...\n')

parseDouyinVideoShare(testText)
  .then((result) => {
    console.log('✅ 解析成功:')
    console.log('原始链接:', result.originalUrl)
    console.log('重定向后:', result.resolvedUrl)
    console.log('视频ID:', result.videoId || '未提取到')
    console.log('用户ID:', result.userId || '未提取到')
  })
  .catch((error) => {
    console.error('❌ 解析失败:', error.message)
    process.exit(1)
  })
