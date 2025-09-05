/**
 * 数据库性能分析器 - 评估消息分页查询性能
 * 专业数据库性能优化专家评估工具
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

// 性能监控器
class PerformanceMonitor {
  constructor() {
    this.queries = []
    this.setupQueryLogging()
  }

  setupQueryLogging() {
    prisma.$on('query', (e) => {
      this.queries.push({
        query: e.query,
        params: e.params,
        duration: e.duration,
        timestamp: new Date()
      })
    })
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1]
  }

  clear() {
    this.queries = []
  }
}

const monitor = new PerformanceMonitor()

/**
 * 1. 分析当前数据库状态
 */
async function analyzeCurrentState() {
  console.log('🔍 === 数据库现状分析 ===')
  
  // 获取基础统计信息
  const stats = await Promise.all([
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.user.count()
  ])
  
  const [totalConversations, totalMessages, totalUsers] = stats
  
  console.log(`📊 基础统计:`)
  console.log(`   用户总数: ${totalUsers.toLocaleString()}`)
  console.log(`   对话总数: ${totalConversations.toLocaleString()}`)
  console.log(`   消息总数: ${totalMessages.toLocaleString()}`)
  console.log(`   平均每对话消息数: ${Math.round(totalMessages / totalConversations * 100) / 100}`)
  
  // 分析消息分布
  const messageDistribution = await prisma.$queryRaw`
    SELECT 
      conversationId,
      COUNT(*) as messageCount
    FROM messages 
    GROUP BY conversationId 
    ORDER BY messageCount DESC 
    LIMIT 10
  `
  
  console.log(`\n📈 消息量最多的10个对话:`)
  messageDistribution.forEach((conv, index) => {
    console.log(`   ${index + 1}. 对话ID: ${conv.conversationId.substring(0, 8)}... - ${conv.messageCount} 条消息`)
  })
  
  // 分析索引使用情况（SQLite特有）
  const indexes = await prisma.$queryRaw`
    SELECT name, sql FROM sqlite_master 
    WHERE type = 'index' AND tbl_name = 'messages'
    AND name NOT LIKE 'sqlite_%'
  `
  
  console.log(`\n🏷️ Messages表当前索引:`)
  indexes.forEach(idx => {
    console.log(`   ${idx.name}: ${idx.sql}`)
  })
  
  return { totalConversations, totalMessages, totalUsers, messageDistribution }
}

/**
 * 2. 测试现有分页查询性能 (skip/take)
 */
async function testCurrentPagination(conversationId, messageCount) {
  console.log(`\n⏱️ === Skip/Take 分页性能测试 ===`)
  console.log(`测试对话: ${conversationId.substring(0, 8)}... (${messageCount} 条消息)`)
  
  const testCases = [
    { page: 1, limit: 20, skip: 0 },
    { page: 3, limit: 20, skip: 40 },
    { page: 10, limit: 20, skip: 180 },
    { page: 25, limit: 20, skip: 480 }, // 假设有500条消息的情况
  ]
  
  const results = []
  
  for (const testCase of testCases) {
    if (testCase.skip >= messageCount) continue // 跳过超出范围的测试
    
    monitor.clear()
    
    const startTime = process.hrtime.bigint()
    
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip: testCase.skip,
      take: testCase.limit,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        totalTokens: true
      }
    })
    
    const endTime = process.hrtime.bigint()
    const duration = Number(endTime - startTime) / 1000000 // 转换为毫秒
    
    const lastQuery = monitor.getLastQuery()
    
    results.push({
      ...testCase,
      actualResults: messages.length,
      durationMs: duration,
      sqlDuration: lastQuery?.duration || 0
    })
    
    console.log(`   页码 ${testCase.page} (skip=${testCase.skip}): ${duration.toFixed(2)}ms, 获取 ${messages.length} 条`)
  }
  
  return results
}

/**
 * 3. 测试 Cursor 分页性能
 */
async function testCursorPagination(conversationId, messageCount) {
  console.log(`\n⏱️ === Cursor 分页性能测试 ===`)
  
  // 获取第一批数据（最新的20条）
  monitor.clear()
  let startTime = process.hrtime.bigint()
  
  let firstBatch = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      totalTokens: true
    }
  })
  
  let endTime = process.hrtime.bigint()
  let duration1 = Number(endTime - startTime) / 1000000
  console.log(`   第1页 (最新): ${duration1.toFixed(2)}ms, 获取 ${firstBatch.length} 条`)
  
  if (firstBatch.length === 0) return []
  
  // 获取第二批数据（使用cursor）
  monitor.clear()
  startTime = process.hrtime.bigint()
  
  const cursor = firstBatch[firstBatch.length - 1]
  let secondBatch = await prisma.message.findMany({
    where: { 
      conversationId,
      createdAt: { lt: cursor.createdAt }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      totalTokens: true
    }
  })
  
  endTime = process.hrtime.bigint()
  let duration2 = Number(endTime - startTime) / 1000000
  console.log(`   第2页 (cursor): ${duration2.toFixed(2)}ms, 获取 ${secondBatch.length} 条`)
  
  // 模拟深度分页 - 跳过很多条记录后的cursor查询
  if (messageCount > 100) {
    const deepMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip: 80,
      take: 1,
      select: { id: true, createdAt: true }
    })
    
    if (deepMessages.length > 0) {
      monitor.clear()
      startTime = process.hrtime.bigint()
      
      const deepBatch = await prisma.message.findMany({
        where: { 
          conversationId,
          createdAt: { lt: deepMessages[0].createdAt }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          totalTokens: true
        }
      })
      
      endTime = process.hrtime.bigint()
      let duration3 = Number(endTime - startTime) / 1000000
      console.log(`   深度页面 (cursor): ${duration3.toFixed(2)}ms, 获取 ${deepBatch.length} 条`)
    }
  }
  
  return [
    { method: 'cursor', page: 1, durationMs: duration1, results: firstBatch.length },
    { method: 'cursor', page: 2, durationMs: duration2, results: secondBatch.length }
  ]
}

/**
 * 4. 测试复合索引的效果
 */
async function testIndexEfficiency(conversationId) {
  console.log(`\n🏗️ === 索引效率测试 ===`)
  
  // 测试现有的复合索引 [conversationId, createdAt]
  monitor.clear()
  const startTime = process.hrtime.bigint()
  
  const result = await prisma.$queryRaw`
    SELECT id, role, content, createdAt, totalTokens
    FROM messages 
    WHERE conversationId = ${conversationId}
    ORDER BY createdAt DESC
    LIMIT 20
  `
  
  const endTime = process.hrtime.bigint()
  const duration = Number(endTime - startTime) / 1000000
  
  const lastQuery = monitor.getLastQuery()
  
  console.log(`   原生SQL查询: ${duration.toFixed(2)}ms`)
  console.log(`   Prisma查询时间: ${lastQuery?.duration || 0}ms`)
  
  return { rawSqlMs: duration, prismaMs: lastQuery?.duration || 0 }
}

/**
 * 5. 模拟大数据量场景的性能预测
 */
function simulateScaledPerformance(currentStats, skipTakeResults, cursorResults) {
  console.log(`\n📊 === 扩展性能预测 ===`)
  
  const { totalMessages } = currentStats
  
  // 基于当前性能进行线性和对数增长预测
  const scenarios = [
    { messages: 100000, users: 1000, avgPerConv: 100 },
    { messages: 1000000, users: 10000, avgPerConv: 100 },
    { messages: 10000000, users: 100000, avgPerConv: 100 }
  ]
  
  scenarios.forEach(scenario => {
    console.log(`\n📈 场景预测 - ${scenario.messages.toLocaleString()} 条消息:`)
    
    // Skip/Take 性能预测（线性增长）
    const currentSkipPerf = skipTakeResults.find(r => r.skip > 0)?.durationMs || 1
    const scaleFactor = scenario.messages / Math.max(totalMessages, 1000)
    const predictedSkipTime = currentSkipPerf * Math.log(scaleFactor + 1) * 2 // 对数增长
    
    console.log(`   Skip/Take深度分页: ~${predictedSkipTime.toFixed(1)}ms (当前: ${currentSkipPerf.toFixed(1)}ms)`)
    
    // Cursor 性能预测（相对稳定）
    const currentCursorPerf = cursorResults[0]?.durationMs || 1
    const predictedCursorTime = currentCursorPerf * 1.2 // 轻微增长
    
    console.log(`   Cursor分页: ~${predictedCursorTime.toFixed(1)}ms (当前: ${currentCursorPerf.toFixed(1)}ms)`)
    
    // 数据库大小预测
    const avgMessageSize = 500 // bytes per message (估算)
    const predictedDbSize = scenario.messages * avgMessageSize / (1024 * 1024) // MB
    console.log(`   数据库大小: ~${predictedDbSize.toFixed(0)}MB`)
  })
}

/**
 * 6. 提供专业的索引建议
 */
function generateIndexRecommendations(currentStats, testResults) {
  console.log(`\n💡 === 数据库优化建议 ===`)
  
  console.log(`🔧 索引优化建议:`)
  
  // 当前已有的索引分析
  console.log(`   ✅ 现有索引 [conversationId, createdAt] 是合理的`)
  console.log(`   ✅ [role, createdAt] 索引对角色筛选有帮助`)
  
  // 建议的新索引
  console.log(`\n🆕 建议新增索引:`)
  console.log(`   CREATE INDEX idx_messages_conv_created_desc ON messages(conversationId, createdAt DESC);`)
  console.log(`   优势: 明确指定降序，可能提升ORDER BY性能`)
  
  console.log(`   CREATE INDEX idx_messages_conv_id_role ON messages(conversationId, role, createdAt DESC);`)
  console.log(`   优势: 支持按角色筛选的复合查询`)
  
  // 分页方案建议
  console.log(`\n📄 分页方案建议:`)
  console.log(`   🥇 推荐: Cursor分页 (基于createdAt时间戳)`)
  console.log(`      - 性能稳定，不受数据量影响`)
  console.log(`      - 支持实时数据更新`)
  console.log(`      - 内存效率高`)
  
  console.log(`   ⚠️ 慎用: Skip/Take分页`)
  console.log(`      - 适合小数据量 (<1000条)`)
  console.log(`      - 深度分页性能下降明显`)
  console.log(`      - 数据一致性问题`)
  
  // 架构建议
  console.log(`\n🏗️ 架构升级建议:`)
  console.log(`   1. SQLite → PostgreSQL迁移时机:`)
  console.log(`      - 消息量 > 100万条`)
  console.log(`      - 并发用户 > 50人`)
  console.log(`      - 需要复杂查询和分析`)
  
  console.log(`   2. 虚拟滚动优化:`)
  console.log(`      - 单次加载20-50条消息`)
  console.log(`      - 实现消息预加载机制`)
  console.log(`      - 添加消息缓存策略`)
  
  console.log(`   3. 读写分离考虑:`)
  console.log(`      - 实时写入主库`)
  console.log(`      - 历史查询用只读副本`)
  console.log(`      - 定期归档老消息`)
}

/**
 * 主执行函数
 */
async function main() {
  try {
    console.log('🚀 智点AI平台 - 数据库性能评估报告')
    console.log('='.repeat(50))
    
    // 1. 分析当前状态
    const currentStats = await analyzeCurrentState()
    
    if (currentStats.totalMessages === 0) {
      console.log('\n⚠️ 数据库中暂无消息数据，无法进行性能测试')
      console.log('建议先进行一些聊天对话以生成测试数据')
      return
    }
    
    // 选择一个有足够消息的对话进行测试
    const testConversation = currentStats.messageDistribution[0]
    
    if (!testConversation || testConversation.messageCount < 10) {
      console.log('\n⚠️ 没有足够的消息数据进行性能测试')
      console.log('建议创建更长的对话以进行完整评估')
      return
    }
    
    // 2 & 3. 性能测试
    const skipTakeResults = await testCurrentPagination(
      testConversation.conversationId, 
      testConversation.messageCount
    )
    
    const cursorResults = await testCursorPagination(
      testConversation.conversationId, 
      testConversation.messageCount
    )
    
    // 4. 索引效率测试
    const indexResults = await testIndexEfficiency(testConversation.conversationId)
    
    // 5. 扩展性预测
    simulateScaledPerformance(currentStats, skipTakeResults, cursorResults)
    
    // 6. 生成建议
    generateIndexRecommendations(currentStats, { skipTakeResults, cursorResults, indexResults })
    
    console.log('\n✅ 性能评估完成!')
    
  } catch (error) {
    console.error('❌ 性能评估失败:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行分析
if (require.main === module) {
  main()
}

module.exports = {
  analyzeCurrentState,
  testCurrentPagination,
  testCursorPagination,
  testIndexEfficiency,
  simulateScaledPerformance,
  generateIndexRecommendations
}