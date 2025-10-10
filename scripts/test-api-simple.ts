/**
 * 简化的API测试 - 直接使用已知用户UID
 */

const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || 'nasQXM88xWilwWy0O6/F5DftDxaSfaA9vSPz62eARtiKgAucPXmRZzaxaA=='
const TIKHUB_API_BASE = 'https://api.tikhub.io'

// 示例：使用一个公开的知名抖音账号进行测试
// 这里使用"人民日报"的sec_uid作为测试
const TEST_SEC_UID = 'MS4wLjABAAAA5qHmT0R5VZp7dNPVoFJ' // 示例UID，需要替换为真实的

async function apiRequest(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(endpoint, TIKHUB_API_BASE)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  console.log(`\n🔗 API请求: ${endpoint}`)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${TIKHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    console.log(`📊 状态码: ${response.status}`)

    if (response.status !== 200) {
      console.error('❌ 错误响应:', JSON.stringify(data, null, 2))
      throw new Error(`API错误: ${response.status}`)
    }

    return data
  } catch (error: any) {
    console.error('❌ 请求失败:', error.message)
    throw error
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║      TikHub API 快速测试                       ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  try {
    // 测试1: 验证API Key
    console.log('【测试1】验证API Key有效性')
    const keyInfo = await apiRequest('/api/v1/tikhub/user/get_user_info')
    console.log('✅ API Key有效')
    console.log('   名称:', keyInfo.api_key_data?.api_key_name)
    console.log('   权限数:', keyInfo.api_key_data?.api_key_scopes?.length)

    // 测试2: 尝试不同的用户资料获取方法
    console.log('\n【测试2】尝试获取用户资料（使用UID）')

    // 方法1: 使用uid（而不是sec_uid）
    console.log('\n尝试方法1: 使用 uid 参数...')
    try {
      const profile1 = await apiRequest('/api/v1/douyin/app/v3/fetch_user_profile', {
        uid: '57568923142' // 示例UID
      })
      console.log('✅ 成功获取用户资料（方法1）')
      console.log('   昵称:', profile1.data?.nickname)
      console.log('   粉丝数:', profile1.data?.follower_count?.toLocaleString())
    } catch (e: any) {
      console.log('⚠️  方法1失败:', e.message)
    }

    // 方法2: 使用sec_uid
    console.log('\n尝试方法2: 使用 sec_uid 参数...')
    try {
      const profile2 = await apiRequest('/api/v1/douyin/app/v3/fetch_user_profile', {
        sec_uid: 'MS4wLjABAAAA-yJu7qjOx7kNIf2pS8sNv4fYm8Ec2g_k8ZJaD9sZOgE'
      })
      console.log('✅ 成功获取用户资料（方法2）')
      console.log('   昵称:', profile2.data?.nickname)
      console.log('   粉丝数:', profile2.data?.follower_count?.toLocaleString())
    } catch (e: any) {
      console.log('⚠️  方法2失败:', e.message)
    }

    // 测试3: 查看TikHub文档建议的默认参数
    console.log('\n【测试3】使用TikHub文档的示例参数')
    console.log('根据错误提示，应该查看文档: https://api.tikhub.io/#/Douyin-App-V3-API/')
    console.log('让我们尝试使用App V1版本的API...')

    try {
      // 使用V1版本的API
      const profileV1 = await apiRequest('/api/v1/douyin/app/v1/handler_user_profile', {
        sec_user_id: 'MS4wLjABAAAA-yJu7qjOx7kNIf2pS8sNv4fYm8Ec2g_k8ZJaD9sZOgE'
      })
      console.log('✅ 成功获取用户资料（V1 API）')
      console.log(JSON.stringify(profileV1, null, 2).substring(0, 500))
    } catch (e: any) {
      console.log('⚠️  V1 API失败:', e.message)
    }

    // 测试4: 列出可用的抖音API端点
    console.log('\n【测试4】根据API Key权限，以下抖音相关端点可用:')
    const scopes = keyInfo.api_key_data?.api_key_scopes || []
    const douyinScopes = scopes.filter((s: string) => s.includes('douyin'))
    douyinScopes.forEach((scope: string) => {
      console.log('   -', scope)
    })

    console.log('\n═══════════════════════════════════════════════════')
    console.log('💡 建议:')
    console.log('1. 访问 https://api.tikhub.io/ 查看Swagger文档')
    console.log('2. 找到 "Douyin-App-V3-API" 或 "Douyin-Web-API" 部分')
    console.log('3. 使用默认示例参数测试，找到正确的参数格式')
    console.log('4. 或者提供一个真实的抖音用户分享链接，我可以尝试解析')
    console.log('═══════════════════════════════════════════════════\n')

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    process.exit(1)
  }
}

main()
