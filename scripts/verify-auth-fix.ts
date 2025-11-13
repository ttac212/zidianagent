/**
 * 验证 Next-Auth 修复
 */

require('dotenv').config({ path: '.env.local' })

import { authOptions } from '@/auth'

async function verifyAuthFix() {
  console.log('\n=== Next-Auth 配置验证 ===\n')

  // 1. 检查配置
  console.log('1️⃣  Next-Auth 配置:')
  console.log(`   Session 策略: ${authOptions.session?.strategy}`)
  console.log(`   Adapter: ${authOptions.adapter ? '已配置 (可能导致问题)' : '未配置 ✓'}`)
  console.log(`   Debug 模式: ${authOptions.debug ? '开启' : '关闭'}`)
  console.log(`   Providers: ${authOptions.providers.length} 个`)

  // 2. 验证 JWT 策略
  if (authOptions.session?.strategy === 'jwt') {
    console.log('\n2️⃣  ✓ 使用 JWT 策略（正确）')
    console.log('   - 不需要数据库会话表')
    console.log('   - 不需要 PrismaAdapter')
    console.log('   - 会话存储在客户端 cookie 中')
  }

  // 3. 检查 Adapter
  if (authOptions.adapter) {
    console.log('\n❌ 警告: 配置了 Adapter，但使用 JWT 策略')
    console.log('   建议: 移除 adapter 配置以避免不必要的数据库查询')
  } else {
    console.log('\n3️⃣  ✓ 未配置 Adapter（符合 JWT 策略）')
  }

  // 4. 检查回调函数
  console.log('\n4️⃣  回调函数:')
  console.log(`   jwt callback: ${authOptions.callbacks?.jwt ? '✓ 已配置' : '✗ 未配置'}`)
  console.log(`   session callback: ${authOptions.callbacks?.session ? '✓ 已配置' : '✗ 未配置'}`)

  // 5. 检查环境变量
  console.log('\n5️⃣  环境变量:')
  const requiredEnvVars = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'DEV_LOGIN_CODE'
  ]

  let missingVars = 0
  for (const varName of requiredEnvVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`   ✓ ${varName}: 已设置`)
    } else {
      console.log(`   ✗ ${varName}: 未设置`)
      missingVars++
    }
  }

  console.log('\n=== 验证结果 ===\n')

  const issues: string[] = []

  if (authOptions.adapter) {
    issues.push('❌ 配置了不必要的 PrismaAdapter')
  }

  if (missingVars > 0) {
    issues.push(`❌ 缺少 ${missingVars} 个环境变量`)
  }

  if (authOptions.session?.strategy !== 'jwt') {
    issues.push('❌ 未使用 JWT 策略')
  }

  if (issues.length === 0) {
    console.log('✅ 配置正确，应该不会出现 CLIENT_FETCH_ERROR 错误\n')
    console.log('💡 如果仍然出现错误，请检查:')
    console.log('   1. 重启开发服务器 (pnpm dev)')
    console.log('   2. 清除浏览器缓存和 cookies')
    console.log('   3. 检查浏览器控制台的详细错误信息')
  } else {
    console.log('⚠️  发现以下问题:\n')
    issues.forEach(issue => console.log(`   ${issue}`))
  }

  console.log()
}

verifyAuthFix().catch(console.error)
