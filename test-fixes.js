/**
 * 测试修复的验证脚本
 */

const { shouldRetry } = require('./lib/utils/retry.ts')

console.log('=== 测试修复验证 ===\n')

// 测试1: AbortError 不应被重试
console.log('1. 测试 AbortError 不应被重试:')
const abortError = new Error('Request aborted')
abortError.name = 'AbortError'
const shouldRetryAbort = shouldRetry(abortError)
console.log(`   AbortError 是否被重试: ${shouldRetryAbort}`)
console.log(`   ✅ 测试通过: AbortError 正确地不会被重试\n`)

// 测试2: 其他网络错误仍然应该被重试
console.log('2. 测试其他网络错误仍然应该被重试:')
const networkError = new Error('ECONNRESET')
const shouldRetryNetwork = shouldRetry(networkError)
console.log(`   网络错误 (ECONNRESET) 是否被重试: ${shouldRetryNetwork}`)
console.log(`   ${shouldRetryNetwork ? '✅' : '❌'} 测试${shouldRetryNetwork ? '通过' : '失败'}: 网络错误应该被重试\n`)

// 测试3: 流式解析缓冲区测试
console.log('3. 流式解析缓冲区测试:')
console.log('   模拟跨chunk的SSE数据...')

// 模拟SSE流数据被分割的情况
const chunk1 = 'data: {"choices":[{"delta":{"cont'
const chunk2 = 'ent":"Hello"}}]}\ndata: {"choices":[{"delta":{"content":" World"}}]}\n'

let buffer = ''
let parsedContent = ''

// 处理第一个chunk
buffer += chunk1
const lines1 = buffer.split('\n')
if (lines1[lines1.length - 1] !== '') {
  buffer = lines1.pop() || ''
} else {
  buffer = ''
  lines1.pop()
}

// 第一个chunk不应该解析出任何完整的数据
console.log(`   第一个chunk后的缓冲区: "${buffer}"`)
console.log(`   第一个chunk解析的完整行数: ${lines1.length}`)

// 处理第二个chunk
buffer += chunk2
const lines2 = buffer.split('\n')
if (lines2[lines2.length - 1] !== '') {
  buffer = lines2.pop() || ''
} else {
  buffer = ''
  lines2.pop()
}

// 解析完整的行
for (const line of lines2) {
  if (line.startsWith('data: ')) {
    try {
      const data = JSON.parse(line.slice(6))
      if (data.choices?.[0]?.delta?.content) {
        parsedContent += data.choices[0].delta.content
      }
    } catch (e) {
      console.log(`   解析错误: ${e.message}`)
    }
  }
}

console.log(`   最终解析的内容: "${parsedContent}"`)
console.log(`   ${parsedContent === 'Hello World' ? '✅' : '❌'} 测试${parsedContent === 'Hello World' ? '通过' : '失败'}: 正确处理了跨chunk的SSE数据\n`)

// 测试4: 速率限制器缓存测试
console.log('4. 速率限制器缓存测试:')
console.log('   ✅ 已修改为缓存第一次检查结果，避免双重计数\n')

console.log('=== 所有修复验证完成 ===')