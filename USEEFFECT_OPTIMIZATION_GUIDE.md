# useEffect 手动优化指南

**重要提示**: 不建议批量自动修改，应逐个手动审查和优化

---

## 优先级分类

根据分析结果，83处useEffect按优先级分为：
- ✅ 必要的 (26处) - 保持不变
- ⚠️ 需要优化 (57处) - 逐个手动审查
- ❌ 可删除 (0处)

---

## 常见问题和解决方案

### 1. 缺少依赖数组

**问题代码**:
```typescript
useEffect(() => {
  console.log(count)
})  // 缺少依赖数组，每次渲染都执行
```

**修复方案**:
```typescript
// 如果只需要执行一次
useEffect(() => {
  console.log('mounted')
}, [])

// 如果依赖外部变量
useEffect(() => {
  console.log(count)
}, [count])

// 或使用专用Hook
import { useMount } from '@/hooks/use-effect-helpers'
useMount(() => {
  console.log('mounted')
})
```

### 2. 仅用于状态派生

**问题代码**:
```typescript
const [filteredData, setFilteredData] = useState([])

useEffect(() => {
  setFilteredData(data.filter(item => item.active))
}, [data])
```

**修复方案**:
```typescript
// 直接在渲染时计算
const filteredData = useMemo(
  () => data.filter(item => item.active),
  [data]
)

// 或者如果性能不是问题，直接计算
const filteredData = data.filter(item => item.active)
```

### 3. 事件监听

**问题代码**:
```typescript
useEffect(() => {
  const handleResize = () => setWidth(window.innerWidth)
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

**修复方案**:
```typescript
import { useEventListener } from '@/hooks/use-effect-helpers'

useEventListener('resize', () => {
  setWidth(window.innerWidth)
})
```

### 4. 定时器

**问题代码**:
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1)
  }, 1000)
  return () => clearInterval(timer)
}, [])
```

**修复方案**:
```typescript
import { useInterval } from '@/hooks/use-effect-helpers'

useInterval(() => {
  setCount(c => c + 1)
}, 1000)
```

### 5. 依赖过多

**问题代码**:
```typescript
useEffect(() => {
  doSomething(a, b, c, d, e, f)
}, [a, b, c, d, e, f])
```

**修复方案**:
```typescript
// 方案1: 拆分为多个effect
useEffect(() => {
  doSomethingWithAB(a, b)
}, [a, b])

useEffect(() => {
  doSomethingWithCD(c, d)
}, [c, d])

// 方案2: 使用useReducer管理复杂状态
const [state, dispatch] = useReducer(reducer, initialState)

// 方案3: 稳定函数引用
const handleSomething = useCallback(() => {
  doSomething(a, b, c, d, e, f)
}, [a, b, c, d, e, f])

useEffect(() => {
  handleSomething()
}, [handleSomething])
```

### 6. 异步操作

**问题代码**:
```typescript
useEffect(() => {
  async function fetchData() {
    const result = await api.getData()
    setData(result)
  }
  fetchData()
}, [])
```

**修复方案**:
```typescript
import { useAsyncEffect } from '@/hooks/use-effect-helpers'

useAsyncEffect(async () => {
  const result = await api.getData()
  setData(result)
}, [])

// 或更好的方案：使用React Query
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['data'],
  queryFn: api.getData
})
```

---

## 手动审查流程

### 步骤1: 运行分析工具
```bash
npx tsx scripts/analyze-useeffect.ts
```

查看输出的需要优化的useEffect列表。

### 步骤2: 逐个审查

对每个标记的useEffect：

1. **理解目的**: 这个effect要做什么？
2. **检查依赖**: 是否缺少依赖数组？依赖是否完整？
3. **考虑替代方案**:
   - 能否移到事件处理器？
   - 能否用派生状态替代？
   - 是否有专用Hook可以使用？
4. **修复并测试**: 修改后运行测试确保功能正常

### 步骤3: 优先处理高风险文件

按以下顺序处理：

1. **Hooks目录** (30处)
   - 影响面广
   - 可能被多处使用
   - 优先级最高

2. **Components目录** (30处)
   - 用户界面组件
   - 影响用户体验
   - 优先级中

3. **App目录** (22处)
   - 页面级组件
   - 影响范围明确
   - 优先级中

4. **Lib目录** (1处)
   - 工具函数
   - 优先级低

---

## 使用专用Hook的好处

已创建的专用Hook (`use-effect-helpers.ts`)：

| Hook | 用途 | 替代场景 |
|------|------|----------|
| `useEventListener` | 事件监听 | DOM事件绑定 |
| `usePrevious` | 跟踪前值 | 对比新旧值 |
| `useMount` | 组件挂载 | componentDidMount |
| `useUnmount` | 组件卸载 | componentWillUnmount |
| `useUpdateEffect` | 更新时执行 | 跳过首次渲染 |
| `useAsyncEffect` | 异步操作 | 数据获取 |
| `useDebounceEffect` | 防抖执行 | 搜索输入 |
| `useThrottleEffect` | 节流执行 | 滚动监听 |
| `useInterval` | 定时重复 | setInterval |
| `useTimeout` | 延迟执行 | setTimeout |
| `useWindowSize` | 窗口大小 | resize监听 |
| `usePageVisibility` | 页面可见性 | visibilitychange |

---

## ESLint配置

添加ESLint规则自动检查：

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

这会警告缺少依赖的useEffect。

---

## 测试策略

每次优化后：

1. **单元测试**: 运行相关组件的测试
   ```bash
   pnpm test -- <component-file>
   ```

2. **E2E测试**: 运行端到端测试
   ```bash
   pnpm test:e2e
   ```

3. **手动测试**: 在浏览器中验证功能

---

## 记录优化进度

使用以下格式记录：

```markdown
## useEffect 优化记录

### hooks/use-conversations.ts
- **问题**: 缺少依赖数组
- **修复**: 添加空依赖数组
- **测试**: ✅ 通过
- **日期**: 2025-01-28

### components/chat/chat-input.tsx
- **问题**: 事件监听应使用专用Hook
- **修复**: 替换为 useEventListener
- **测试**: ✅ 通过
- **日期**: 2025-01-28
```

---

## 总结

**不要批量自动修改** - useEffect的行为复杂，自动化工具容易误判。

**正确方法**:
1. 使用分析工具识别问题
2. 手动审查每个case
3. 使用专用Hook简化常见模式
4. 每次修改后充分测试
5. 记录优化过程

**预期时间**: 57处优化，预计需要2-3天时间逐个处理。