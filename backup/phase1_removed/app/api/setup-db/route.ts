import { NextRequest, NextResponse } from 'next/server'

// 数据库设置向导 - 帮助用户配置数据库连接 - 仅开发环境可用
export async function GET() {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DB_SETUP) {
    return NextResponse.json(
      { error: 'Setup endpoint not available in production' },
      { status: 404 }
    )
  }
  try {
    return NextResponse.json({
      message: '数据库配置向导',
      instructions: [
        '1. 确保 PostgreSQL 服务正在运行',
        '2. 打开 pgAdmin 或 SQL Shell (psql)',
        '3. 使用以下命令创建数据库:',
        '   CREATE DATABASE zhidianai;',
        '4. 创建用户（如果需要）:',
        '   CREATE USER postgres WITH PASSWORD \'<your-password>\';',
        '   GRANT ALL PRIVILEGES ON DATABASE zhidianai TO postgres;',
        '5. 更新 .env.local 中的连接字符串',
      ],
      currentConfig: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'zhidianai',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD ? '***' : '<not-configured>'
      },
      testEndpoint: '/api/setup-db/test'
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// 测试数据库连接 - 仅开发环境可用
export async function POST(request: NextRequest) {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DB_SETUP) {
    return NextResponse.json(
      { error: 'Setup endpoint not available in production' },
      { status: 404 }
    )
  }
  try {
    const { host, port, database, user, password } = await request.json()
    
    // 构建连接字符串
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`
    
    return NextResponse.json({
      success: true,
      connectionString,
      message: '连接字符串已生成，请复制到 .env.local 文件中',
      nextSteps: [
        '1. 复制上面的 connectionString 到 .env.local 的 DATABASE_URL',
        '2. 访问 /api/setup-db/init 初始化数据库表'
      ]
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: String(error) 
      }, 
      { status: 500 }
    )
  }
}