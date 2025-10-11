# 创意文案审计增强 - 关键讨论点

## 快速总览

**目标**：在现有批量生成 5 条文案的基础上，增加智能审计流程，推荐 1 条最佳文案，并保留其他文案的亮点片段。

**核心流程**：
```
生成 5 条文案 → 审计模型评估 → 标记最佳 + 提取片段 → 前端展示推荐
```

**影响范围**：
- ✅ 向后兼容：旧批次不受影响
- ✅ 可选功能：用户可关闭审计
- ✅ 数据模型：仅扩展 JSON 字段（metadata），无需新表

---

## 关键决策点（需讨论）

### 1. 审计模型选择

#### 选项 A：使用与生成相同的模型
- ✅ 简单，无需额外配置
- ❌ 成本较高（如都用 Claude Opus）

#### 选项 B：默认使用更便宜的模型（推荐）
- ✅ 节省成本（审计任务相对简单）
- ✅ 允许高级用户自定义
- 示例配置：
  ```typescript
  {
    auditConfig: {
      enabled: true,
      modelId: 'claude-3-5-haiku-20241022', // 默认用 Haiku
      criteriaPrompt: ''                     // 可选自定义标准
    }
  }
  ```

**建议**：选项 B，默认 Haiku，允许覆盖。

---

### 2. 审计失败的处理策略

#### 场景：审计模型返回错误或格式不符
**问题**：是否应该中止批次？

#### 选项 A：审计失败则批次失败
- ❌ 用户体验差（已生成的 5 条文案被浪费）

#### 选项 B：审计失败不影响批次状态（推荐）
- ✅ 批次仍标记为 SUCCEEDED
- ✅ 记录 GenerationException（错误码 `AUDIT_FAILED`）
- ✅ 前端显示"自动审计失败，请手动选择"

**建议**：选项 B，遵循 Linus"不要丢弃用户数据"的原则。

---

### 3. 保留片段的存储位置

#### 选项 A：存储在推荐文案的 metadata 中
- ❌ 逻辑混乱（片段来自其他文案）
- ❌ 删除非推荐文案后片段丢失

#### 选项 B：存储在批次 metadata 中（推荐）
- ✅ 集中管理，便于查询
- ✅ 独立于单条文案的生命周期
- 示例结构：
  ```typescript
  {
    auditResult: {
      recommendedSequence: 2,
      reason: "情感调动最强，行动号召明确",
      highlights: [
        {
          sequence: 1,
          type: 'opening',
          content: "春节将至，你准备好了吗？"
        },
        {
          sequence: 3,
          type: 'cta',
          content: "点击链接，立享 8 折优惠！"
        }
      ]
    }
  }
  ```

#### 选项 C：同时存储在批次和文案 metadata 中
- ✅ 冗余存储，便于不同场景读取
- ❌ 维护成本高，可能不一致

**建议**：选项 B，存储在批次 metadata，前端按需读取和展示。

---

### 4. 前端交互设计

#### 4.1 推荐标记的展示方式

**问题**：如何让用户快速识别推荐文案？

#### 方案 A：仅使用 Badge 标记
```tsx
<Badge variant="success">
  <Star className="h-3 w-3" /> 推荐
</Badge>
```

#### 方案 B：卡片边框高亮 + Badge（推荐）
```tsx
<Card className={cn(
  'transition-all',
  isRecommended && 'border-green-500 shadow-lg'
)}>
  <CardHeader>
    <Badge variant="success">⭐ 推荐</Badge>
    <Text className="text-xs">{recommendReason}</Text>
  </CardHeader>
</Card>
```

**建议**：方案 B，视觉更突出。

---

#### 4.2 保留片段的展示位置

**问题**：片段来自其他文案，放在哪里展示？

#### 选项 A：在批次详情顶部单独展示
```tsx
{batch.auditResult?.highlights && (
  <Card>
    <CardHeader>
      <Badge>💡 精选片段</Badge>
    </CardHeader>
    <CardContent>
      {highlights.map(h => (
        <BlockQuote key={h.sequence}>
          来自文案 {h.sequence} 的{h.type}
          {h.content}
        </BlockQuote>
      ))}
    </CardContent>
  </Card>
)}
```

#### 选项 B：在各文案卡片内展示（推荐）
- 推荐文案卡片：显示完整内容
- 非推荐文案卡片：显示"保留片段"折叠区域

**建议**：选项 B，更符合用户浏览习惯。

---

### 5. 选题和对标文案的输入方式

#### 5.1 选题（Topics）

**问题**：应该是标签输入还是文本域？

#### 方案 A：标签输入（推荐）
```tsx
<TagInput
  placeholder="输入选题，按回车添加"
  tags={topics}
  onTagsChange={setTopics}
/>
```
- ✅ 结构化，便于后续分析（如"春节营销"选题效果对比）
- ✅ 支持预设推荐（如常见节日、行业场景）

#### 方案 B：文本域
- ❌ 非结构化，难以统计

**建议**：方案 A，使用标签输入。

---

#### 5.2 对标文案（Benchmark Copy）

**问题**：是否需要区分"来源"和"内容"？

#### 方案 A：单一文本域
```tsx
<Textarea placeholder="粘贴参考案例" />
```
- ❌ 缺少来源追溯

#### 方案 B：结构化输入（推荐）
```tsx
<FormField>
  <Label>对标文案</Label>
  <Textarea placeholder="粘贴参考案例内容" />
  <Input placeholder="来源（如：竞品A 2024年春节推广）" />
</FormField>
```
- ✅ 便于后续分析对标效果

**建议**：方案 B，记录来源信息。

---

### 6. 手工录入 REPORT/PROMPT 的交互流程

#### 当前缺失的功能
用户需要手动录入商家分析报告和提示词，但现有 UI 未提供明确入口。

#### 建议实现路径

**商家资产管理页面** (`/creative/merchants/:id/assets`)
```
┌─────────────────────────────────────────────────────┐
│ 商家：XX奶茶店                                          │
├─────────────────────────────────────────────────────┤
│ 📄 商家分析报告                                         │
│   ✅ 当前版本：v3 (2025-01-15)                         │
│   [查看内容] [更新版本] [历史版本]                       │
├─────────────────────────────────────────────────────┤
│ 📝 提示词模板                                           │
│   ✅ 当前版本：v2 (2025-01-10)                         │
│   [查看内容] [更新版本] [历史版本]                       │
├─────────────────────────────────────────────────────┤
│ 📎 参考资料                                            │
│   - 春节营销方案.pdf                                    │
│   - 竞品文案 (3条)                                      │
│   [添加资料]                                           │
└─────────────────────────────────────────────────────┘
```

**操作流程**：
1. 点击"更新版本"打开对话框
2. 填写标题和内容（支持 Markdown）
3. 选择"设为活跃版本"
4. 保存后自动递增版本号

---

### 7. 与对话模块的联动

#### 用户场景
用户对推荐文案不满意，希望进行深度改写。

#### 建议实现方式

**文案卡片添加操作按钮**：
```tsx
<CardFooter>
  <Button variant="outline" onClick={handleEdit}>
    ✏️ 编辑
  </Button>
  <Button variant="outline" onClick={handleRegenerate}>
    🔄 重新生成
  </Button>
  <Button variant="outline" onClick={handleChatRewrite}>
    💬 对话改写
  </Button>
</CardFooter>
```

**跳转到对话模块**：
```typescript
function handleChatRewrite(copy: CreativeCopy) {
  router.push(`/creative/conversations/new?copyId=${copy.id}`)
}

// 在对话页面初始化
const initialContext = `
# 当前文案（待改写）
${copy.markdownContent}

# 商家背景
${merchant.report}

# 改写要求
请根据以上背景，对当前文案进行优化...
`
```

**技术实现**：
- 复用现有对话系统（`/app/page.tsx` 的聊天组件）
- 自动填充初始消息
- 保留对话历史（关联 `copyId`）

---

### 8. 成本与性能考虑

#### 8.1 成本估算

**假设**：
- 生成模型：Claude Sonnet ($3/M tokens)
- 审计模型：Claude Haiku ($0.25/M tokens)
- 每个批次平均：10k tokens 生成 + 2k tokens 审计

**单批次成本**：
- 生成：$0.03
- 审计：$0.005
- 总计：$0.035（审计占比 14%）

**结论**：审计成本可接受。

---

#### 8.2 性能影响

**当前批次生成时间**：约 30-60 秒（Claude Sonnet）

**增加审计后**：
- 串行执行：+10-15 秒（审计时间）
- 并行优化：可在生成完成后异步审计，不阻塞文案展示

**建议**：
1. Phase 1：串行执行（简单）
2. Phase 2：异步审计（优化），批次状态：
   - `GENERATING` → `AUDITING` → `SUCCEEDED`

---

### 9. 测试策略

#### 9.1 审计逻辑单元测试
```typescript
describe('auditCopies', () => {
  it('should recommend the best copy', async () => {
    const result = await auditCopies(batchId, copies, materials)
    expect(result.recommendedSequence).toBeGreaterThanOrEqual(1)
    expect(result.recommendedSequence).toBeLessThanOrEqual(5)
    expect(result.reason).toBeTruthy()
  })

  it('should extract highlights from other copies', async () => {
    const result = await auditCopies(batchId, copies, materials)
    expect(result.highlights).toBeInstanceOf(Array)
    result.highlights.forEach(h => {
      expect(h.sequence).not.toBe(result.recommendedSequence)
      expect(['opening', 'body', 'cta']).toContain(h.type)
    })
  })

  it('should handle audit failure gracefully', async () => {
    // Mock API error
    vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'))
    
    await expect(auditCopies(batchId, copies, materials)).rejects.toThrow()
    
    // 验证 GenerationException 被记录
    const exception = await prisma.generationException.findFirst({
      where: { batchId, errorCode: 'AUDIT_FAILED' }
    })
    expect(exception).toBeTruthy()
  })
})
```

---

#### 9.2 E2E 测试
```typescript
test('complete batch generation with audit', async ({ page }) => {
  // 1. 创建批次（启用审计）
  await page.goto('/creative/merchants/test-merchant/batches')
  await page.click('button:has-text("创建批次")')
  await page.fill('input[name="topics"]', '春节营销')
  await page.check('input[name="auditConfig.enabled"]')
  await page.click('button:has-text("开始生成")')

  // 2. 等待生成完成
  await page.waitForSelector('text=生成完成', { timeout: 120000 })

  // 3. 验证推荐标记
  const recommendedBadge = page.locator('text=⭐ 推荐').first()
  await expect(recommendedBadge).toBeVisible()

  // 4. 验证推荐理由
  const reasonText = page.locator('[data-testid="recommend-reason"]')
  await expect(reasonText).toContainText(/契合|创意|感染力/)

  // 5. 验证保留片段
  await page.click('text=保留片段')
  const highlights = page.locator('[data-testid="highlight-item"]')
  await expect(highlights).toHaveCount({ min: 1 })
})
```

---

## 下一步行动建议

### 立即决策（今天）
1. ✅ 审计模型选择：Haiku vs. Sonnet
2. ✅ 失败处理策略：不影响批次 vs. 批次失败
3. ✅ 片段存储位置：批次 metadata vs. 文案 metadata

### 短期实施（本周）
1. 实现审计逻辑核心（`auditCopies` 函数）
2. 扩展 Worker 流程
3. 编写单元测试

### 中期实施（下周）
1. API 扩展（创建批次、查询详情）
2. 前端组件改造（批次创建表单、文案卡片）
3. E2E 测试

### 长期优化（未来）
1. 异步审计（性能优化）
2. 审计标准模板（行业预设）
3. 与对话模块深度联动

---

## 关键文件清单

### 后端
- `lib/workers/creative-batch-worker.ts` - 审计逻辑核心
- `lib/repositories/creative-batch-repository.ts` - 数据存储
- `app/api/creative/batches/route.ts` - API 扩展

### 前端
- `components/creative/create-batch-dialog.tsx` - 批次创建表单
- `components/creative/batch-info-card.tsx` - 审计结果展示
- `components/creative/copy-card.tsx` - 文案卡片推荐标记
- `app/creative/merchants/[merchantId]/assets/page.tsx` - 资产管理

### 测试
- `tests/creative-audit.test.ts` - 审计逻辑单元测试
- `e2e/creative-audit.spec.ts` - E2E 完整流程测试

---

## 技术债务提醒

**避免的陷阱**：
1. ❌ 不要创建新表（使用现有 metadata 字段）
2. ❌ 不要破坏现有批次（向后兼容）
3. ❌ 不要强制启用审计（用户可关闭）
4. ❌ 不要在审计失败时丢弃已生成的文案

**遵循的原则**：
1. ✅ 简单胜过复杂（Linus 哲学）
2. ✅ 渐进增强（先核心功能，再扩展）
3. ✅ 用户第一（所有功能可选）
4. ✅ 数据驱动（记录审计结果供分析）

---

**准备好开始讨论了吗？** 🚀
