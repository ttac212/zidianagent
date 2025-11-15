import dns from 'dns/promises'
import https from 'https'
import { promisify } from 'util'
import { config } from 'dotenv'
import path from 'path'

/**
 * ZenMux API连接诊断脚本
 * 用于排查TLS握手失败和网络连接问题
 */

// 加载环境变量
config({ path: path.resolve(process.cwd(), '.env.local') })

const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY || ''

console.log('🔍 开始ZenMux API连接诊断...\n')

// 1. DNS解析测试
async function testDNS() {
  console.log('1️⃣ DNS解析测试')
  console.log('━'.repeat(50))

  const hostname = 'zenmux.ai'

  try {
    const addresses = await dns.resolve4(hostname)
    console.log(`✅ DNS解析成功: ${hostname}`)
    console.log(`   IP地址: ${addresses.join(', ')}`)

    // 测试IPv6
    try {
      const addresses6 = await dns.resolve6(hostname)
      console.log(`   IPv6地址: ${addresses6.join(', ')}`)
    } catch {
      console.log(`   ⚠️ 无IPv6地址`)
    }
  } catch (error) {
    console.error(`❌ DNS解析失败:`, error)
    return false
  }

  console.log()
  return true
}

// 2. TLS握手测试
async function testTLS() {
  console.log('2️⃣ TLS握手测试')
  console.log('━'.repeat(50))

  return new Promise((resolve) => {
    const options = {
      hostname: 'zenmux.ai',
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 10000,
      rejectUnauthorized: true // 验证证书
    }

    console.log(`   正在连接 ${options.hostname}:${options.port}...`)

    const req = https.request(options, (res) => {
      const socket = res.socket as any
      console.log(`✅ TLS握手成功`)
      console.log(`   TLS版本: ${socket.getProtocol()}`)
      console.log(`   加密套件: ${socket.getCipher()?.name || 'Unknown'}`)
      console.log(`   证书主题: ${socket.getPeerCertificate()?.subject?.CN || 'Unknown'}`)
      console.log(`   HTTP状态码: ${res.statusCode}`)

      res.on('data', () => {}) // 消费数据
      res.on('end', () => {
        console.log()
        resolve(true)
      })
    })

    req.on('error', (error: any) => {
      console.error(`❌ TLS连接失败:`, error.message)
      console.error(`   错误代码: ${error.code}`)

      if (error.code === 'ECONNRESET') {
        console.error(`   💡 可能原因:`)
        console.error(`      - 防火墙拦截了TLS连接`)
        console.error(`      - 需要配置代理`)
        console.error(`      - Node.js版本过旧（建议使用v18+）`)
      }

      console.log()
      resolve(false)
    })

    req.on('timeout', () => {
      console.error(`❌ 连接超时（10秒）`)
      console.log()
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

// 3. 测试基本API调用（不带推理模式）
async function testBasicAPI() {
  console.log('3️⃣ 基本API调用测试（不带推理）')
  console.log('━'.repeat(50))

  if (!ZENMUX_API_KEY) {
    console.error('❌ 缺少ZENMUX_API_KEY环境变量')
    console.log()
    return false
  }

  const url = `${ZENMUX_API_BASE}/chat/completions`
  console.log(`   请求URL: ${url}`)

  const payload = {
    model: 'anthropic/claude-sonnet-4.5',
    messages: [
      { role: 'user', content: 'Hello, say hi in Chinese' }
    ],
    max_tokens: 100,
    stream: false
  }

  try {
    console.log(`   正在发送请求...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZENMUX_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    console.log(`   响应状态: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API调用失败:`, errorText)
      console.log()
      return false
    }

    const data = await response.json()
    console.log(`✅ API调用成功`)
    console.log(`   模型: ${data.model}`)
    console.log(`   Token使用: ${JSON.stringify(data.usage)}`)
    console.log(`   响应内容: ${data.choices?.[0]?.message?.content?.slice(0, 50)}...`)

  } catch (error: any) {
    console.error(`❌ API调用失败:`, error.message)

    if (error.code === 'ECONNRESET') {
      console.error(`   💡 这是TLS握手失败，不是API错误`)
    }

    console.log()
    return false
  }

  console.log()
  return true
}

// 4. 测试推理模式API调用
async function testReasoningAPI() {
  console.log('4️⃣ 推理模式API调用测试')
  console.log('━'.repeat(50))

  if (!ZENMUX_API_KEY) {
    console.error('❌ 缺少ZENMUX_API_KEY环境变量')
    console.log()
    return false
  }

  const url = `${ZENMUX_API_BASE}/chat/completions`
  console.log(`   请求URL: ${url}`)

  const payload = {
    model: 'openai/gpt-5.1',
    messages: [
      { role: 'user', content: 'What is 2+2?' }
    ],
    max_tokens: 500,
    stream: false,
    reasoning: {
      effort: 'high'
    }
  }

  try {
    console.log(`   正在发送推理模式请求...`)
    console.log(`   ⚠️ 推理模式可能需要较长时间（最多120秒）`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZENMUX_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    })

    console.log(`   响应状态: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ 推理模式API调用失败:`, errorText)
      console.log()
      return false
    }

    const data = await response.json()
    console.log(`✅ 推理模式API调用成功`)
    console.log(`   模型: ${data.model}`)
    console.log(`   Token使用: ${JSON.stringify(data.usage)}`)

    if (data.choices?.[0]?.message?.reasoning) {
      console.log(`   推理内容长度: ${data.choices[0].message.reasoning.length} 字符`)
    }

  } catch (error: any) {
    console.error(`❌ 推理模式API调用失败:`, error.message)

    if (error.code === 'ECONNRESET') {
      console.error(`   💡 这是TLS握手失败，不是API错误`)
    }

    console.log()
    return false
  }

  console.log()
  return true
}

// 5. 环境信息检查
function checkEnvironment() {
  console.log('5️⃣ 环境信息检查')
  console.log('━'.repeat(50))

  console.log(`   Node.js版本: ${process.version}`)
  console.log(`   平台: ${process.platform} ${process.arch}`)
  console.log(`   TLS版本: ${process.versions.openssl}`)

  console.log(`\n   环境变量:`)
  console.log(`   ZENMUX_API_BASE: ${ZENMUX_API_BASE}`)
  console.log(`   ZENMUX_API_KEY: ${ZENMUX_API_KEY ? `${ZENMUX_API_KEY.slice(0, 20)}...` : '未设置'}`)

  // 检查代理配置
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy

  if (httpProxy || httpsProxy) {
    console.log(`\n   ⚠️ 检测到代理配置:`)
    if (httpProxy) console.log(`   HTTP_PROXY: ${httpProxy}`)
    if (httpsProxy) console.log(`   HTTPS_PROXY: ${httpsProxy}`)
  } else {
    console.log(`\n   ℹ️ 未配置代理`)
  }

  console.log()
}

// 主函数
async function main() {
  checkEnvironment()

  const dnsOk = await testDNS()
  if (!dnsOk) {
    console.log('❌ DNS解析失败，无法继续后续测试')
    process.exit(1)
  }

  const tlsOk = await testTLS()
  if (!tlsOk) {
    console.log('❌ TLS握手失败，无法继续后续测试')
    console.log('\n💡 建议解决方案:')
    console.log('   1. 检查防火墙设置，允许访问 zenmux.ai:443')
    console.log('   2. 如果在公司网络，可能需要配置HTTP代理')
    console.log('   3. 尝试更新Node.js到最新LTS版本（v20+）')
    console.log('   4. 临时禁用杀毒软件的网络监控功能')
    console.log('   5. 尝试使用302.AI作为备选Provider（修改代码切换）')
    process.exit(1)
  }

  const basicApiOk = await testBasicAPI()
  const reasoningApiOk = await testReasoningAPI()

  console.log('📊 诊断结果总结')
  console.log('━'.repeat(50))
  console.log(`DNS解析: ${dnsOk ? '✅ 正常' : '❌ 失败'}`)
  console.log(`TLS握手: ${tlsOk ? '✅ 正常' : '❌ 失败'}`)
  console.log(`基本API调用: ${basicApiOk ? '✅ 正常' : '❌ 失败'}`)
  console.log(`推理模式API: ${reasoningApiOk ? '✅ 正常' : '❌ 失败'}`)

  if (dnsOk && tlsOk && basicApiOk && reasoningApiOk) {
    console.log('\n✅ 所有测试通过！ZenMux API连接正常')
  } else {
    console.log('\n❌ 部分测试失败，请根据上述建议排查问题')
    process.exit(1)
  }
}

main().catch(console.error)
