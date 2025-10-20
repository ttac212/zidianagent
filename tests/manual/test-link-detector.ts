import { extractDouyinLink, isDouyinShareRequest } from '../../lib/douyin/link-detector'

const testCases = [
  // 用户提供的完整分享文本
  '{2.07 e@B.Ty Fhb:/ 03/09 年轻人装修真的不必太传统!能不要的就不要！能砸的就全砸了！ 思路打开能入住就行了！# 入住毛坯房 # 抖音好家大赏 # 抖音有好家 # 内容过于真实 # 年轻人装修真的不必太传统  https://v.douyin.com/TZggHTcoKBc/ 复制此链接，打开Dou音搜索，直接观看视频！}',

  // 纯链接
  'https://v.douyin.com/TZggHTcoKBc/',

  // 带描述的分享
  '看看这个视频 https://v.douyin.com/TZggHTcoKBc/ 复制此链接，打开抖音',

  // 对话式请求（不应该触发pipeline）
  '这个视频 https://v.douyin.com/TZggHTcoKBc/ 说的对吗？我觉得不太对，你怎么看？',

  // 新格式：包含连字符的短链接
  '在本地，手表走时不准维修需要多少钱？输入手表品牌获取报价 https://v.douyin.com/KYgiZhqu-w8/ 复制此链接，打开【抖音】，直接观看视频！',
]

console.log('=== 链接提取测试 ===\n')

testCases.forEach((text, index) => {
  console.log(`测试 ${index + 1}:`)
  console.log(`文本: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`)
  console.log(`提取的链接: ${extractDouyinLink(text)}`)
  console.log(`是否为分享请求: ${isDouyinShareRequest(text)}`)
  console.log('---\n')
})
