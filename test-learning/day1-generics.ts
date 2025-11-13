// Day 1 下午：TypeScript泛型和高级类型练习
// 学习目标：掌握泛型、泛型约束、实用工具类型

// ==================== 任务1：泛型函数 ====================
// TODO: 编写一个createArray函数，创建指定长度和值的数组
// 提示：使用泛型 <T> 让函数支持任意类型

function createArray<T>(length: number, value: T): T[] {
  return Array(length).fill(value)
}

// 测试
const numbers = createArray<number>(3, 0)  // [0, 0, 0]
const strings = createArray<string>(2, 'hello')  // ['hello', 'hello']
const booleans = createArray(3, true)  // 类型推断：boolean[]

console.log('✅ 任务1完成：泛型函数')
console.log('数字数组:', numbers)
console.log('字符串数组:', strings)
console.log('布尔数组:', booleans)


// ==================== 任务2：泛型接口 ====================
// TODO: 定义一个通用的API响应类型
// 提示：泛型参数T代表数据的类型

interface ApiResponse<T> {
  data: T
  error: string | null
  success: boolean
  timestamp: Date
}

// 使用示例1：返回用户数据
interface User {
  id: string
  email: string
  role: 'USER' | 'ADMIN' | 'GUEST'
  createdAt: Date
}

const userResponse: ApiResponse<User> = {
  data: {
    id: '1',
    email: 'test@test.com',
    role: 'USER',
    createdAt: new Date()
  },
  error: null,
  success: true,
  timestamp: new Date()
}

// 使用示例2：返回消息列表
interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
}

const messagesResponse: ApiResponse<Message[]> = {
  data: [
    { id: '1', content: 'Hello', role: 'user' },
    { id: '2', content: 'Hi there!', role: 'assistant' }
  ],
  error: null,
  success: true,
  timestamp: new Date()
}

console.log('\n✅ 任务2完成：泛型接口')
console.log('用户响应:', userResponse)
console.log('消息响应:', messagesResponse)


// ==================== 任务3：泛型约束 ====================
// TODO: 编写一个函数，返回对象的键数组
// 提示：使用 extends 约束泛型参数

function getKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[]
}

// 测试
const user = {
  id: '1',
  email: 'test@test.com',
  role: 'USER'
}

const keys = getKeys(user)  // 类型：('id' | 'email' | 'role')[]
console.log('\n✅ 任务3完成：泛型约束')
console.log('对象的键:', keys)

// getKeys(123)  // ❌ 错误：数字不是object类型


// ==================== 任务4：实用工具类型 ====================
// TODO: 使用TypeScript内置的工具类型

// Partial - 所有属性变为可选
type PartialUser = Partial<User>
const partialUser: PartialUser = {
  email: 'partial@test.com'
  // id、role、createdAt都是可选的
}

// Required - 所有属性变为必需
interface OptionalConfig {
  theme?: 'light' | 'dark'
  language?: string
}
type RequiredConfig = Required<OptionalConfig>
const config: RequiredConfig = {
  theme: 'dark',
  language: 'zh-CN'
  // 都是必需的
}

// Pick - 选择部分属性
type UserEmailAndRole = Pick<User, 'email' | 'role'>
const emailAndRole: UserEmailAndRole = {
  email: 'pick@test.com',
  role: 'USER'
  // 只有email和role
}

// Omit - 排除部分属性
type UserWithoutDates = Omit<User, 'createdAt'>
const userWithoutDate: UserWithoutDates = {
  id: '1',
  email: 'omit@test.com',
  role: 'ADMIN'
  // 没有createdAt
}

// Record - 创建键值对类型
type UserRoles = 'admin' | 'user' | 'guest'
type RolePermissions = Record<UserRoles, string[]>
const permissions: RolePermissions = {
  admin: ['read', 'write', 'delete'],
  user: ['read', 'write'],
  guest: ['read']
}

console.log('\n✅ 任务4完成：实用工具类型')
console.log('Partial User:', partialUser)
console.log('Required Config:', config)
console.log('Picked User:', emailAndRole)
console.log('Omitted User:', userWithoutDate)
console.log('Role Permissions:', permissions)


// ==================== 任务5：实践 - 阅读项目类型 ====================
// TODO: 打开项目的 types/chat.ts 文件，理解其中的类型定义
// 文件路径：D:\zdqidongxiangmu\types\chat.ts

// 以下是项目中关键类型的简化版本：

// ChatMessage类型（项目实际使用）
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'pending' | 'streaming' | 'completed' | 'error'
  reasoning?: string
  createdAt: Date
  metadata?: Record<string, any>
}

// ChatAction联合类型（项目实际使用）
type ChatAction =
  | { type: 'SEND_USER_MESSAGE'; payload: { message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE_STREAM'; payload: { id: string; content: string } }
  | { type: 'REMOVE_MESSAGE'; payload: { id: string } }
  | { type: 'SET_ERROR'; payload: { error: string } }

console.log('\n✅ 任务5提示：阅读项目类型定义')
console.log('请打开文件：types/chat.ts')
console.log('理解 ChatMessage、ChatState、ChatAction 的定义')


// ==================== 挑战任务：泛型工具函数 ====================
// TODO: 实现一个类型安全的深度获取函数
// 提示：这是一个高级练习，尽力尝试即可

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// 测试
const testUser: User = {
  id: '1',
  email: 'challenge@test.com',
  role: 'USER',
  createdAt: new Date()
}

const email = getProperty(testUser, 'email')  // 类型：string
const role = getProperty(testUser, 'role')    // 类型：'USER' | 'ADMIN' | 'GUEST'
// const invalid = getProperty(testUser, 'invalid')  // ❌ 编译错误

console.log('\n✅ 挑战任务完成：类型安全的属性访问')
console.log('Email:', email)
console.log('Role:', role)


// ==================== 验证标准 ====================
console.log('\n\n========== Day 1 下午验证 ==========')
console.log('✅ 能编写泛型函数（createArray<T>）')
console.log('✅ 能定义泛型接口（ApiResponse<T>）')
console.log('✅ 能使用泛型约束（T extends object）')
console.log('✅ 能使用工具类型（Partial, Omit, Pick, Record）')
console.log('✅ 能理解项目中的类型定义')
console.log('\n现在运行：npx tsx day1-generics.ts')
console.log('然后打开项目文件：types/chat.ts')
