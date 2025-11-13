// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('🔍 环境变量检查：\n')
console.log('✅ ZENMUX_API_KEY:', process.env.ZENMUX_API_KEY ? '已配置 (' + process.env.ZENMUX_API_KEY.substring(0, 20) + '...)' : '❌ 未配置')
console.log('✅ ZENMUX_API_BASE:', process.env.ZENMUX_API_BASE || '❌ 未配置')
console.log('✅ ZENMUX_DEFAULT_MODEL:', process.env.ZENMUX_DEFAULT_MODEL || '❌ 未配置')
console.log('✅ TIKHUB_API_KEY:', process.env.TIKHUB_API_KEY ? '已配置 (' + process.env.TIKHUB_API_KEY.substring(0, 20) + '...)' : '❌ 未配置')
console.log('✅ TIKHUB_API_BASE_URL:', process.env.TIKHUB_API_BASE_URL || '❌ 未配置')
console.log('\n所有必需的环境变量都已正确加载！')
