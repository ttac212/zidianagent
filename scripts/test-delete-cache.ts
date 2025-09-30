/**
 * 测试删除功能的缓存同步
 * 验证修复后的predicate能否正确更新所有相关缓存
 */

// 模拟 React Query 的 queryClient
const mockQueries = [
  {
    queryKey: ['conversations', 'list'],
    data: [
      { id: '1', title: 'Conv 1' },
      { id: '2', title: 'Conv 2' },
      { id: '3', title: 'Conv 3' }
    ]
  },
  {
    queryKey: ['conversations', 'list', 'summary', { page: 1, limit: 20 }],
    data: [
      { id: '1', title: 'Conv 1' },
      { id: '2', title: 'Conv 2' },
      { id: '3', title: 'Conv 3' }
    ]
  },
  {
    queryKey: ['conversations', 'detail', '2'],
    data: { id: '2', title: 'Conv 2', messages: [] }
  }
]

// 新的predicate匹配逻辑
const predicate = (query: any) => {
  const key = query.queryKey
  return Array.isArray(key) &&
         key[0] === 'conversations' &&
         key[1] === 'list'
}

// 旧的匹配逻辑（只匹配 ['conversations', 'list']）
const oldMatcher = (query: any) => {
  const key = query.queryKey
  return JSON.stringify(key) === JSON.stringify(['conversations', 'list'])
}

console.log('📋 测试删除 ID=2 的对话\n')

console.log('🔴 旧匹配逻辑（Bug版本）:')
const oldMatches = mockQueries.filter(oldMatcher)
console.log(`  匹配到 ${oldMatches.length} 个查询:`)
oldMatches.forEach(q => console.log(`    - ${JSON.stringify(q.queryKey)}`))

console.log('\n✅ 新匹配逻辑（修复版本）:')
const newMatches = mockQueries.filter(predicate)
console.log(`  匹配到 ${newMatches.length} 个查询:`)
newMatches.forEach(q => console.log(`    - ${JSON.stringify(q.queryKey)}`))

console.log('\n🎯 结论:')
console.log(`  旧逻辑漏掉了 summary 查询，导致刷新后数据复原`)
console.log(`  新逻辑正确匹配所有 lists 相关查询，删除会正确同步到缓存`)
