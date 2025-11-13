// Day 1 上午：TypeScript基础类型和接口练习
// 学习目标：掌握interface、type、联合类型、可选属性

// ==================== 任务1：定义用户类型 ====================
// TODO: 定义User接口
// 提示：参考项目的用户模型，包含id、email、displayName、role等字段

interface User {
  id: string
  email: string
  displayName?: string  // 可选属性
  role: 'USER' | 'ADMIN' | 'GUEST'  // 联合类型
  createdAt: Date
}

// 测试User类型
const testUser: User = {
  id: '1',
  email: 'test@test.com',
  role: 'ADMIN',
  createdAt: new Date()
}

console.log('✅ 任务1完成：User类型定义')
console.log('测试用户:', testUser)


// ==================== 任务2：定义消息类型 ====================
// TODO: 定义Message接口
// 提示：消息有id、content、role、createdAt字段

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  createdAt: Date
}

// 测试Message类型
const testMessage: Message = {
  id: 'msg-1',
  content: 'Hello TypeScript!',
  role: 'user',
  createdAt: new Date()
}

console.log('\n✅ 任务2完成：Message类型定义')
console.log('测试消息:', testMessage)


// ==================== 任务3：定义对话类型 ====================
// TODO: 定义Conversation接口
// 提示：对话包含id、title、userId、messages数组、时间戳

interface Conversation {
  id: string
  title: string
  userId: string
  messages: Message[]  // 使用前面定义的Message类型
  createdAt: Date
  updatedAt: Date
}

// 测试Conversation类型
const testConversation: Conversation = {
  id: 'conv-1',
  title: '我的第一个对话',
  userId: '1',
  messages: [testMessage],
  createdAt: new Date(),
  updatedAt: new Date()
}

console.log('\n✅ 任务3完成：Conversation类型定义')
console.log('测试对话:', testConversation)


// ==================== 任务4：类型守卫函数 ====================
// TODO: 编写类型守卫函数，检查用户是否是管理员
// 提示：使用 `user is User & { role: 'ADMIN' }` 语法

function isAdminUser(user: User): user is User & { role: 'ADMIN' } {
  return user.role === 'ADMIN'
}

// 测试类型守卫
if (isAdminUser(testUser)) {
  console.log('\n✅ 任务4完成：类型守卫函数')
  console.log('这是一个管理员用户')
  // 在这个代码块中，TypeScript知道user.role一定是'ADMIN'
} else {
  console.log('这不是管理员用户')
}


// ==================== 挑战任务：复杂类型组合 ====================
// TODO: 定义一个ConversationWithStats类型
// 要求：包含Conversation的所有字段，额外添加统计信息

interface ConversationStats {
  messageCount: number
  totalTokens: number
  lastMessageAt: Date | null
}

// 方式1：使用交叉类型
type ConversationWithStats1 = Conversation & ConversationStats

// 方式2：使用接口继承
interface ConversationWithStats2 extends Conversation {
  messageCount: number
  totalTokens: number
  lastMessageAt: Date | null
}

// 测试
const statsConversation: ConversationWithStats1 = {
  ...testConversation,
  messageCount: 1,
  totalTokens: 100,
  lastMessageAt: new Date()
}

console.log('\n✅ 挑战任务完成：复杂类型组合')
console.log('带统计信息的对话:', statsConversation)


// ==================== 验证标准 ====================
console.log('\n\n========== Day 1 上午验证 ==========')
console.log('✅ 能定义基础接口（User, Message, Conversation）')
console.log('✅ 能使用联合类型（role: "USER" | "ADMIN" | "GUEST"）')
console.log('✅ 能使用可选属性（displayName?）')
console.log('✅ 能编写类型守卫函数（isAdminUser）')
console.log('✅ 能使用交叉类型和接口继承')
console.log('\n现在运行：npx tsx day1-types.ts')
