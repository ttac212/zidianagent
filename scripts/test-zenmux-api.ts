/**
 * 测试ZenMux API优化功能
 */

async function main() {
  console.log('=== 测试ZenMux API ===\n')

  const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY
  const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
  const ZENMUX_DEFAULT_MODEL = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

  if (!ZENMUX_API_KEY) {
    console.error('❌ 缺少 ZENMUX_API_KEY 环境变量')
    process.exit(1)
  }

  console.log('API Base:', ZENMUX_API_BASE)
  console.log('Model:', ZENMUX_DEFAULT_MODEL)
  console.log('API Key:', ZENMUX_API_KEY.substring(0, 20) + '...')
  console.log()

  // 测试文本
  const testText = `
今天我来给大家介绍一下我们成都的装修建材超市
这个超市正在积极的筹备当中
我们主要经营装修材料和工程材料
支持批发和一站式采购
欢迎大家来参观
`

  const videoInfo = {
    title: '成都装修建材超市筹备中',
    author: '测试用户',
    hashtags: ['装修材料', '工程材料', '批发'],
    videoTags: ['生活记录', '日常vlog']
  }

  // 构建上下文信息
  const contextParts = [
    `视频标题：${videoInfo.title}`,
    `作者：${videoInfo.author}`
  ]
  if (videoInfo.hashtags && videoInfo.hashtags.length > 0) {
    contextParts.push(`话题标签：${videoInfo.hashtags.join('、')}`)
  }
  if (videoInfo.videoTags && videoInfo.videoTags.length > 0) {
    contextParts.push(`视频标签：${videoInfo.videoTags.join('、')}`)
  }
  const contextInfo = contextParts.join('\n')

  console.log('=== 测试请求 ===')
  console.log('转录文本:')
  console.log(testText)
  console.log()

  try {
    // 测试流式API
    console.log('发送流式请求到ZenMux...\n')

    const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZENMUX_API_KEY}`
      },
      body: JSON.stringify({
        model: ZENMUX_DEFAULT_MODEL,
        stream: true,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文案编辑。请优化用户提供的转录文本，修正错误，添加标点符号。直接输出优化后的文本，不要添加任何说明。'
          },
          {
            role: 'user',
            content: `${contextInfo}\n\n---\n\n**转录文本：**\n${testText}\n\n---\n\n请优化这段文本，添加标点符号，使其更易读。`
          }
        ],
        max_tokens: 4000,
        temperature: 0.2
      })
    })

    console.log('HTTP状态码:', response.status)
    console.log('响应头:', Object.fromEntries(response.headers.entries()))
    console.log()

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API请求失败')
      console.error('状态码:', response.status)
      console.error('错误信息:', errorText)
      process.exit(1)
    }

    // 处理流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      console.error('❌ 无法读取响应流')
      process.exit(1)
    }

    const decoder = new TextDecoder()
    let optimizedText = ''
    let buffer = ''
    let chunkCount = 0

    console.log('=== 流式响应 ===')
    console.log('开始接收数据...\n')

    let rawChunkCount = 0
    const rawChunks: string[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('\n[流结束]')
          break
        }

        rawChunkCount++
        const chunk = decoder.decode(value, { stream: true })
        rawChunks.push(chunk)

        console.log(`\n[原始Chunk #${rawChunkCount}] 长度: ${chunk.length}`)
        console.log('内容:', chunk.substring(0, 200))

        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          console.log('[行]', line.substring(0, 100))

          if (!line.trim() || line.startsWith(':')) {
            console.log('  -> 跳过（空行或注释）')
            continue
          }
          if (line === 'data: [DONE]') {
            console.log('  -> 收到[DONE]标记')
            continue
          }

          if (line.startsWith('data: ')) {
            chunkCount++
            try {
              const data = JSON.parse(line.slice(6))
              const delta = data.choices?.[0]?.delta?.content

              console.log('  -> 解析成功，delta:', delta ? delta.substring(0, 50) : '(无内容)')

              if (delta) {
                optimizedText += delta
                process.stdout.write(delta) // 实时显示
              }

              // 显示第一个完整的响应结构
              if (chunkCount === 1) {
                console.log('\n\n[第一个chunk的完整结构:]')
                console.log(JSON.stringify(data, null, 2))
                console.log()
              }
            } catch (parseError) {
              console.error('  -> 解析错误:', parseError)
              console.error('  -> 原始行:', line)
            }
          } else {
            console.log('  -> 不是data:行')
          }
        }
      }

      // 处理剩余缓冲区
      if (buffer) {
        const finalChunk = decoder.decode()
        if (finalChunk) {
          buffer += finalChunk
        }
      }
    } finally {
      reader.releaseLock()
    }

    console.log('\n\n=== 结果统计 ===')
    console.log('原始chunk数量:', rawChunkCount)
    console.log('解析chunk数量:', chunkCount)
    console.log('优化后文本长度:', optimizedText.length, '字符')
    console.log()

    // 显示完整的原始数据前1000字符
    console.log('=== 完整原始数据(前1000字符) ===')
    const fullRawData = rawChunks.join('')
    console.log(fullRawData.substring(0, 1000))
    console.log('... (总长度:', fullRawData.length, '字符)')
    console.log()

    if (!optimizedText) {
      console.error('❌ 优化后文本为空')
      process.exit(1)
    }

    console.log('=== 优化后文本 ===')
    console.log(optimizedText)
    console.log()

    console.log('✅ 测试成功！')

  } catch (error: any) {
    console.error('\n❌ 测试失败')
    console.error('错误:', error.message)
    if (error.stack) {
      console.error('堆栈:', error.stack)
    }
    process.exit(1)
  }
}

main()
