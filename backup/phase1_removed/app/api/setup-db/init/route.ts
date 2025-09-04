import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// 手动初始化数据库表的脚本 - 仅开发环境可用
export async function POST() {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DB_SETUP) {
    return NextResponse.json(
      { error: 'Setup endpoint not available in production' },
      { status: 404 }
    )
  }
  let prisma: PrismaClient
  
  try {
    // 创建临时 Prisma 客户端进行初始化
    prisma = new PrismaClient()
    await prisma.$connect()
    
    // 执行原始 SQL 来创建表（因为无法运行 prisma db push）
    // 这里我们手动执行一些关键表的创建
    
    // 创建用户表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "username" TEXT UNIQUE,
        "displayName" TEXT,
        "avatar" TEXT,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "monthlyTokenLimit" INTEGER NOT NULL DEFAULT 100000,
        "currentMonthUsage" INTEGER NOT NULL DEFAULT 0,
        "totalTokenUsed" BIGINT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastActiveAt" TIMESTAMP(3)
      );
    `
    
    // 创建对话表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL DEFAULT '新对话',
        "userId" TEXT NOT NULL,
        "modelId" TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
        "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
        "maxTokens" INTEGER NOT NULL DEFAULT 2000,
        "contextAware" BOOLEAN NOT NULL DEFAULT true,
        "messageCount" INTEGER NOT NULL DEFAULT 0,
        "totalTokens" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastMessageAt" TIMESTAMP(3),
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `
    
    // 创建消息表
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "conversationId" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "originalContent" TEXT,
        "promptTokens" INTEGER NOT NULL DEFAULT 0,
        "completionTokens" INTEGER NOT NULL DEFAULT 0,
        "totalTokens" INTEGER NOT NULL DEFAULT 0,
        "modelId" TEXT NOT NULL,
        "temperature" DOUBLE PRECISION,
        "finishReason" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
      );
    `
    
    // 创建一个测试用户
    const testUser = await prisma.$queryRaw`
      INSERT INTO "users" ("id", "email", "displayName", "role")
      VALUES ('test-user-1', 'test@example.com', '测试用户', 'USER')
      ON CONFLICT ("email") DO NOTHING
      RETURNING *;
    `
    
    await prisma.$disconnect()
    
    return NextResponse.json({
      success: true,
      message: '数据库初始化完成！',
      tablesCreated: ['users', 'conversations', 'messages'],
      testUser: testUser,
      nextSteps: [
        '1. 访问 /api/test-db 验证连接',
        '2. 访问 http://localhost:3001/workspace 测试聊天功能',
        '3. 检查数据库中的表是否创建成功'
      ]
    })
  } catch (error) {
    console.error('数据库初始化错误:', error)
    return NextResponse.json(
      {
        success: false,
        message: '数据库初始化失败',
        error: error instanceof Error ? error.message : String(error),
        suggestions: [
          '1. 确保 PostgreSQL 服务正在运行',
          '2. 确保数据库 "zhidianai" 已创建',
          '3. 检查 .env.local 中的连接字符串是否正确',
          '4. 尝试用 pgAdmin 手动连接数据库'
        ]
      },
      { status: 500 }
    )
  }
}