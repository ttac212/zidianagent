# 批量文案生成 P0 实现总结

## 完成时间
2025-01-15

## 实现范围

### P0 核心功能
1. ✅ 批次详情页（文案查看 + 编辑）
2. ✅ 单条重新生成
3. ✅ 整批重新生成

## 新增文件清单

### 组件（components/creative/）
```
batch-info-card.tsx           # 批次信息卡片
copy-card.tsx                 # 文案卡片（Markdown 预览 + 操作）
copy-edit-dialog.tsx          # 文案编辑对话框（双栏编辑器，移动端 Tab 切换）
copy-regenerate-dialog.tsx    # 单条重新生成对话框
```

### 页面（app/creative/batches/）
```
[batchId]/page.tsx            # 批次详情页面
```

### API（app/api/creative/copies/[copyId]/）
```
regenerate/route.ts           # POST - 单条重新生成
```

## 功能特性

### 批次详情页

**路由**：`/creative/batches/:batchId`

**功能**：
- 显示批次基本信息（状态、模型、Token、文案数量）
- Grid 布局展示文案（2x3 桌面，1x5 移动）
- SSE 实时状态推送（实时连接状态显示）
- 面包屑导航返回列表
- 整批重新生成按钮

**响应式**：
- 桌面：3 列 Grid
- 平板：2 列 Grid
- 移动：1 列堆叠

### 文案卡片（CopyCard）

**展示内容**：
- 文案序号（文案 1-5）
- 状态 Badge（草稿/已通过/已拒绝）
- 版本号（v2+）
- Markdown 渲染预览

**操作按钮**：
- 复制到剪贴板
- 编辑（弹出对话框）
- 单条重新生成
- 更多菜单（标记为通过/拒绝）

**状态**：
- DRAFT（草稿）- secondary Badge
- APPROVED（已通过）- success Badge
- REJECTED（已拒绝）- destructive Badge

### 文案编辑对话框（CopyEditDialog）

**布局**：
- **桌面**：左右分栏（编辑器 | 预览）
- **移动**：Tab 切换（编辑 / 预览）

**功能**：
- Markdown 编辑器（font-mono）
- 实时预览（SecureMarkdown）
- 修改说明输入框（可选）
- 版本自动递增（v2, v3...）

**保存逻辑**：
- 创建新版本记录（creative_copy_revisions）
- 更新 contentVersion
- 记录 editedBy 和 editedAt

### 单条重新生成对话框（CopyRegenerateDialog）

**功能**：
- 显示当前文案内容（Markdown 预览）
- 生成模式选择：
  - 完全重新生成（推荐）
  - 基于当前内容改进
- 补充要求输入框（可选）
- Token 估算显示（~600-800）

**后端逻辑**：
- 创建新批次（parentBatchId 指向原批次）
- 复制原批次资产配置
- metadata 记录再生成上下文
- 生成完成后跳转到新批次页面

### 整批重新生成

**触发位置**：批次信息卡片右上角按钮

**逻辑**：
- 复制原批次所有资产配置
- 创建新批次（parentBatchId 链接）
- 生成 5 条新文案
- 跳转到新批次页面

### SSE 实时推送

**集成**：
- 使用 `useBatchStatusSSE` hook
- 实时连接状态显示（绿点 + "实时连接"）
- 状态更新自动刷新界面
- 文案数量变化触发重新加载
- 完成时 Toast 通知

## API 端点

### GET /api/creative/batches/:batchId
获取批次详情，包含：
- 批次信息
- 所有文案（copies）
- 资产配置（assets）
- 异常记录（exceptions）

**修改**：增加 `copyCount`、`tokenUsage`、`errorMessage` 字段

### PUT /api/creative/copies/:copyId
更新文案内容或状态：
- `content` - 更新内容（创建新版本）
- `state` - 更新状态（DRAFT/APPROVED/REJECTED）
- `note` - 修改说明（可选）

### POST /api/creative/copies/:copyId/regenerate（新增）
单条文案重新生成：
- `mode` - 生成模式（fresh / based-on-current）
- `appendPrompt` - 补充要求（可选）
- `note` - 备注（可选）

**返回**：新批次 ID（前端跳转）

### POST /api/creative/batches/:batchId/regenerate
整批重新生成（已存在）

## 技术实现

### 组件复用
- shadcn/ui 全家桶（Card, Dialog, Button, Badge, Tabs, Textarea 等）
- SecureMarkdown 安全渲染
- 统一的 toast 提示（Sonner）

### 状态管理
- useState 管理对话框状态
- SSE hook 管理实时推送
- useRouter 导航跳转

### 错误处理
- API 错误捕获 + Toast 提示
- 加载状态 Skeleton
- 错误状态 Alert + 重试按钮

### 移动端适配
- Grid 列数响应式（3 → 2 → 1）
- 编辑器双栏 → Tab 切换
- 操作按钮自适应布局

## 测试建议

### 手动测试流程
1. **批次列表** → 点击"查看详情"
2. **批次详情** → 查看文案卡片
3. **编辑文案** → 点击编辑 → 修改内容 → 保存
4. **单条重新生成** → 选择模式 → 添加补充要求 → 生成
5. **整批重新生成** → 点击按钮 → 跳转到新批次
6. **SSE 推送** → 观察实时连接状态 → 状态变化
7. **复制文案** → 点击复制 → 粘贴验证
8. **状态切换** → 标记为通过/拒绝

### 移动端测试
- 响应式布局（Chrome DevTools）
- 编辑器 Tab 切换
- 操作按钮可点击性

## 剩余工作（P1/P2）

### P1 - 完整体验
- 资料管理页面（商家报告、提示词、附件 CRUD）
- 文案版本历史查看
- 整批重新生成对话框（添加补充提示词）

### P2 - 优化增强
- 资料编辑功能（在线编辑）
- 附件上传功能
- 批次归档/删除
- 批次导出（Markdown/CSV）
- 文案对比功能（版本 diff）

## 已知问题

无

## 注意事项

1. **Worker 集成**：批次创建后需要 Worker 处理，确保 Worker 运行
2. **SSE 连接**：需要 session 认证，确保用户已登录
3. **商家权限**：所有操作都需要商家访问权限验证
4. **Markdown 安全**：使用 SecureMarkdown 防止 XSS
5. **移动端体验**：确保所有对话框在移动端可用

## 性能考虑

- 文案列表使用 Grid，避免长列表性能问题
- SSE 连接自动断开（批次完成时）
- Markdown 渲染使用 memoization（SecureMarkdown 内部实现）
- 图片懒加载（如有）

---

**P0 核心功能已全部实现。可投入使用。**
