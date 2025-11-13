/**
 * 测试评论分析触发机制
 * 验证修复后的关键词检测是否正常工作
 */

import {
  isDouyinVideoExtractionRequest,
  isDouyinCommentsAnalysisRequest,
  isDouyinShareRequest
} from '../lib/douyin/link-detector'

const testCases = [
  // 评论分析场景（应该触发评论分析）
  {
    name: '明确评论分析请求（包含问号）',
    input: '分析一下这个视频的评论？https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '评论分析请求（包含"怎么样"）',
    input: '帮我看看评论怎么样 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '评论分析请求（包含"为什么"）',
    input: '评论为什么这么多差评？https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '简单评论关键词',
    input: '评论 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '查看评论区',
    input: 'https://v.douyin.com/k5Nc3QsEQH8 看看评论区',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '用户反馈分析',
    input: '分析用户反馈 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: true,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },

  // 视频文案提取场景（不应该触发评论分析）
  {
    name: '视频文案提取',
    input: '提取这个视频文案 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: true,
      commentsExplicit: false,
      commentsDefault: false,
      shouldTriggerComments: false
    }
  },
  {
    name: '视频转录',
    input: '帮我转录一下 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: true,
      commentsExplicit: false,
      commentsDefault: false,
      shouldTriggerComments: false
    }
  },

  // 纯分享场景（应该触发默认评论分析）
  {
    name: '纯链接分享',
    input: 'https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: false,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },
  {
    name: '官方分享文案',
    input: '7.43 fsc:/ 复制打开抖音，看看【xxx】https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: false,
      commentsDefault: true,
      shouldTriggerComments: true
    }
  },

  // 对话意图场景（不应该触发评论分析）
  {
    name: '强对话意图（你怎么看）',
    input: '你怎么看这个视频？https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: false,
      commentsDefault: false,
      shouldTriggerComments: false
    }
  },
  {
    name: '强对话意图（我觉得）',
    input: '我觉得这个视频不错 https://v.douyin.com/k5Nc3QsEQH8',
    expected: {
      videoExtraction: false,
      commentsExplicit: false,
      commentsDefault: false,
      shouldTriggerComments: false
    }
  }
]

console.log('\n🧪 评论分析触发机制测试\n')
console.log('=' .repeat(80))

let passed = 0
let failed = 0

for (const testCase of testCases) {
  const videoExtraction = isDouyinVideoExtractionRequest(testCase.input)
  const commentsExplicit = isDouyinCommentsAnalysisRequest(testCase.input)
  const commentsDefault = isDouyinShareRequest(testCase.input)

  // 评论分析应该触发：明确评论请求 或 默认分享（且非视频提取）
  const shouldTriggerComments = (commentsExplicit || commentsDefault) && !videoExtraction

  const isCorrect =
    videoExtraction === testCase.expected.videoExtraction &&
    commentsExplicit === testCase.expected.commentsExplicit &&
    commentsDefault === testCase.expected.commentsDefault &&
    shouldTriggerComments === testCase.expected.shouldTriggerComments

  if (isCorrect) {
    passed++
    console.log(`✅ ${testCase.name}`)
  } else {
    failed++
    console.log(`❌ ${testCase.name}`)
    console.log(`   输入: "${testCase.input}"`)
    console.log(`   期望: 视频提取=${testCase.expected.videoExtraction}, 明确评论=${testCase.expected.commentsExplicit}, 默认分享=${testCase.expected.commentsDefault}, 触发评论=${testCase.expected.shouldTriggerComments}`)
    console.log(`   实际: 视频提取=${videoExtraction}, 明确评论=${commentsExplicit}, 默认分享=${commentsDefault}, 触发评论=${shouldTriggerComments}`)
  }
}

console.log('=' .repeat(80))
console.log(`\n📊 测试结果: ${passed}/${testCases.length} 通过, ${failed} 失败\n`)

if (failed > 0) {
  process.exit(1)
}
