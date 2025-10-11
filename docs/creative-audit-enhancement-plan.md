# 创意文案生成审计增强方案

## 1. 现状分析

### 1.1 当前架构优势
✅ **已完成的基础能力**：
- 完善的 Worker 生成流程（`creative-batch-worker.ts`）
- 清晰的资产管理（REPORT/PROMPT/ATTACHMENT）
- 批次状态机制（QUEUED → RUNNING → SUCCEEDED/PARTIAL_SUCCESS/FAILED）
- 版本控制与回退（`CreativeCopyRevision`）
- 父子批次关系（支持再生成）
- SSE 实时推送（通过 statusVersion 机制）

### 1.2 当前限制
⚠️ **需要增强的部分**：
- 固定生成 5 条文案，无审计筛选机制
- 缺少"最佳文案"标记和理由记录
- 没有"选题"和"对标文案"的结构化输入
- 无法保留部分优质片段（如开头、结尾）
- 审计结果无法在 UI 中展示

## 2. 核心需求

### 2.1 生成与审计流程
```
手动录入商家分析（REPORT + PROMPT）
    ↓
用户创建批次（附加选题、对标文案）
    ↓
Worker 生成 5 条文案（主模型）
    ↓
审计模型评估 5 条文案（推荐索引、理由、保留片段）
    ↓
更新文案状态（推荐的设为 APPROVED，其他保留为 DRAFT）
    ↓
前端展示审计结果（推荐标记、理由、保留片段）
```

### 2.2 用户交互场景
1. **批量生成**：用户觉得不错，继续生成 5 条文案供选择
2. **选题驱动**：用户输入特定选题（如"春节营销""新品发布"），生成针对性文案
3. **对标文案**：用户提供参考案例，生成类似风格的文案
4. **片段保留**：审计后保留亮点片段（开头、金句等），供二次创作
5. **跳转改写**：不满意时直接跳转到对话模块深度改写

## 3. 技术设计方案

### 3.1 数据模型扩展

#### A. 批次 Metadata Schema
```typescript
interface CreativeBatchMetadata {
  // 生成配置
  topics?: string[]                    // 选题列表（如 ["春节营销", "新品发布"]）
  benchmarkCopy?: {                     // 对标文案
    source: string                      // 来源说明
    content: string                     // 原文内容
  }
  
  // 审计配置
  auditConfig?: {
    enabled: boolean                    // 是否启用审计
    modelId?: string                    // 审计模型（默认使用批次 modelId）
    criteriaPrompt?: string             // 自定义审计标准
  }
  
  // 审计结果（Worker 执行后写入）
  auditResult?: {
    recommendedSequence: number         // 推荐的文案序号（1-5）
    reason: string                      // 推荐理由
    highlights: {                       // 其他文案的亮点片段
      sequence: number
      type: 'opening' | 'body' | 'cta'  // 片段类型
      content: string
    }[]
    modelOutput?: any                   // 审计模型原始输出
    executedAt: string                  // 审计执行时间
  }
  
  // 单条再生成元信息（已有，保持兼容）
  targetSequence?: number
  editedContent?: string
  appendPrompt?: string
}
```

#### B. CreativeCopy Metadata 扩展
```typescript
interface CreativeCopyMetadata {
  // 审计标记
  isRecommended?: boolean              // 是否为推荐文案
  recommendReason?: string             // 推荐理由
  
  // 保留片段（来自审计结果）
  highlights?: {
    type: 'opening' | 'body' | 'cta'
    content: string
    preservedAt: string
  }[]
  
  // 原有元信息（保持兼容）
  originalSequence?: number
  regenerationMode?: boolean
  fallbackParsed?: boolean
}
```

### 3.2 审计流程集成

#### A. Worker 流程修改（`creative-batch-worker.ts`）
```typescript
export async function processBatch(input: BatchWorkerInput): Promise<void> {
  // ... 现有步骤 1-3 保持不变 ...

  // 4. 写入初始文案
  await saveCopies(batchId, result.copies)

  // ⭐ 新增：审计流程（仅批量生成模式）
  if (targetSequence === undefined && shouldEnableAudit(materials.metadata)) {
    const auditResult = await auditCopies(batchId, result.copies, materials)
    
    // 更新批次 metadata
    await updateBatchMetadata(batchId, { auditResult })
    
    // 更新文案状态和元信息
    await applyAuditResult(batchId, auditResult)
  }

  // 5. 决定最终状态（保持不变）
  const finalStatus = decideFinalStatus(result.copies.length, targetSequence)
  await updateBatchStatus({ batchId, status: finalStatus, ... })
}

/**
 * 审计文案质量
 */
async function auditCopies(
  batchId: string,
  copies: GeneratedCopy[],
  materials: any
): Promise<AuditResult> {
  const auditPrompt = buildAuditPrompt(copies, materials)
  const modelId = materials.metadata?.auditConfig?.modelId || materials.modelId
  
  const response = await callAIForAudit(modelId, auditPrompt)
  
  return parseAuditResponse(response)
}
```

#### B. 审计提示词设计
```typescript
function buildAuditPrompt(copies: GeneratedCopy[], materials: any): string {
  return `你是一个专业的短视频文案审计专家。

# 审计任务
评估以下 ${copies.length} 条短视频文案，选出 1 条最佳文案，并提取其他文案的亮点片段。

# 评估维度
1. **契合度**：与商家定位和目标受众的匹配程度
2. **创意性**：独特的切入点和表达方式
3. **感染力**：情绪调动和行动号召的有效性
4. **可执行性**：适合短视频配音的流畅度

${materials.metadata?.auditConfig?.criteriaPrompt ? `
# 自定义评估标准
${materials.metadata.auditConfig.criteriaPrompt}
` : ''}

# 待审计文案
${copies.map((c, i) => `
## 文案 ${c.sequence}
${c.markdownContent}
`).join('\n')}

# 输出要求
严格按照以下 JSON 格式输出：

\`\`\`json
{
  "recommendedSequence": 2,                    // 推荐的文案序号（1-${copies.length}）
  "reason": "推荐理由（100字以内）",
  "highlights": [                              // 其他文案的亮点片段（可选）
    {
      "sequence": 1,
      "type": "opening",                       // opening | body | cta
      "content": "具体的亮点片段原文"
    }
  ]
}
\`\`\`

注意：
1. 必须选择一条文案作为推荐
2. highlights 字段可以为空数组，但如果提取片段，需指明具体内容
3. 推荐理由需简洁明确，突出核心优势`
}
```

### 3.3 API 扩展

#### A. 创建批次 API 增强（`POST /api/creative/batches`）
```typescript
const requestSchema = z.object({
  merchantId: z.string().min(1),
  parentBatchId: z.string().min(1).optional(),
  assets: z.array(assetSchema).min(2),
  
  // ⭐ 新增：选题和对标
  topics: z.array(z.string()).optional(),
  benchmarkCopy: z.object({
    source: z.string(),
    content: z.string()
  }).optional(),
  
  // ⭐ 新增：审计配置
  auditConfig: z.object({
    enabled: z.boolean().default(true),
    modelId: z.string().optional(),
    criteriaPrompt: z.string().optional()
  }).optional()
})

// 在 createBatchWithAssets 调用中传递 metadata
const { batch } = await createBatchWithAssets({
  merchantId,
  triggeredBy: token.sub,
  assets: assetsInput,
  parentBatchId: parentBatchId ?? null,
  metadata: {
    topics: parsed.data.topics,
    benchmarkCopy: parsed.data.benchmarkCopy,
    auditConfig: parsed.data.auditConfig || { enabled: true }
  }
})
```

#### B. 查询批次详情增强（`GET /api/creative/batches/:id`）
```typescript
// 返回数据包含审计结果
{
  id: string
  status: CreativeBatchStatus
  copies: [{
    id: string
    sequence: number
    markdownContent: string
    state: 'DRAFT' | 'APPROVED' | 'REJECTED'
    isRecommended: boolean              // ⭐ 新增
    recommendReason?: string            // ⭐ 新增
    highlights?: Highlight[]            // ⭐ 新增
  }]
  auditResult?: {                       // ⭐ 新增
    recommendedSequence: number
    reason: string
    executedAt: string
  }
}
```

### 3.4 前端改造

#### A. 批次创建表单增强（`components/creative/create-batch-dialog.tsx`）
```tsx
// 新增输入字段
<FormField name="topics">
  <Label>选题标签（可选）</Label>
  <TagInput placeholder="输入选题，按回车添加" />
</FormField>

<FormField name="benchmarkCopy">
  <Label>对标文案（可选）</Label>
  <Textarea placeholder="粘贴参考案例" />
  <Input placeholder="来源说明" />
</FormField>

<FormField name="auditConfig">
  <Checkbox checked={auditEnabled} onChange={setAuditEnabled}>
    启用智能审计（推荐最佳文案）
  </Checkbox>
  {auditEnabled && (
    <Textarea placeholder="自定义审计标准（可选）" />
  )}
</FormField>
```

#### B. 批次详情展示增强（`components/creative/batch-info-card.tsx`）
```tsx
// 显示审计结果
{batch.auditResult && (
  <Card className="border-l-4 border-l-green-500">
    <CardHeader>
      <Badge variant="success">智能推荐</Badge>
      <Text>推荐文案 #{batch.auditResult.recommendedSequence}</Text>
    </CardHeader>
    <CardContent>
      <Text className="text-sm text-muted-foreground">
        {batch.auditResult.reason}
      </Text>
    </CardContent>
  </Card>
)}

// 文案卡片显示推荐标记
<CopyCard
  copy={copy}
  isRecommended={copy.isRecommended}
  recommendReason={copy.recommendReason}
  highlights={copy.highlights}
/>
```

#### C. 文案卡片增强（`components/creative/copy-card.tsx`）
```tsx
<Card className={cn(isRecommended && 'border-green-500 shadow-md')}>
  <CardHeader>
    <div className="flex items-center gap-2">
      <Badge>文案 {copy.sequence}</Badge>
      {isRecommended && (
        <Badge variant="success" className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          推荐
        </Badge>
      )}
    </div>
    {recommendReason && (
      <Text className="text-xs text-muted-foreground">{recommendReason}</Text>
    )}
  </CardHeader>
  
  <CardContent>
    <Markdown>{copy.markdownContent}</Markdown>
    
    {highlights && highlights.length > 0 && (
      <Collapsible>
        <CollapsibleTrigger>
          <Badge variant="outline">保留片段 ({highlights.length})</Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {highlights.map((h, i) => (
            <Card key={i} variant="ghost">
              <Badge>{h.type === 'opening' ? '开头' : h.type === 'cta' ? '结尾' : '正文'}</Badge>
              <Text className="text-sm">{h.content}</Text>
            </Card>
          ))}
        </CollapsibleContent>
      </Collapsible>
    )}
  </CardContent>
</Card>
```

### 3.5 手工录入流程

#### A. 商家资产管理页面增强（`app/creative/merchants/:id/assets/page.tsx`）
```tsx
// 当前版本状态展示
<Card>
  <CardHeader>
    <div className="flex justify-between">
      <div>
        <Badge variant={reportActive ? 'success' : 'secondary'}>
          商家分析报告 {reportActive ? `v${reportVersion}` : '未设置'}
        </Badge>
      </div>
      <Button onClick={() => openCreateAssetDialog('REPORT')}>
        {reportActive ? '更新版本' : '创建报告'}
      </Button>
    </div>
  </CardHeader>
  {reportActive && (
    <CardContent>
      <Text className="text-xs text-muted-foreground">
        创建于 {formatDate(report.createdAt)} · 共 {report.version} 个版本
      </Text>
      <Button variant="ghost" size="sm" onClick={() => viewAssetHistory('REPORT')}>
        查看历史版本
      </Button>
    </CardContent>
  )}
</Card>

// 类似地展示 PROMPT 状态
```

#### B. 资产创建对话框（`components/creative/create-asset-dialog.tsx`）
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>
        {type === 'REPORT' ? '创建商家分析报告' : '创建提示词模板'}
      </DialogTitle>
    </DialogHeader>
    
    <Form onSubmit={handleSubmit}>
      <FormField name="title">
        <Label>标题</Label>
        <Input placeholder={type === 'REPORT' ? '如：2025年春节营销分析' : '如：春节营销文案模板'} />
      </FormField>
      
      <FormField name="content">
        <Label>内容（支持 Markdown）</Label>
        <Textarea
          rows={20}
          placeholder={
            type === 'REPORT'
              ? '# 商家基本信息\n\n## 品牌定位\n\n## 目标受众\n\n## 核心卖点\n\n...'
              : '# 文案结构\n\n## 开头\n\n## 正文\n\n## 结尾\n\n...'
          }
        />
      </FormField>
      
      <FormField name="isActive">
        <Checkbox checked={isActive} onChange={setIsActive}>
          设为当前活跃版本（生成批次时自动使用）
        </Checkbox>
      </FormField>
      
      <DialogFooter>
        <Button type="submit">保存</Button>
      </DialogFooter>
    </Form>
  </DialogContent>
</Dialog>
```

## 4. 实施计划

### Phase 1: 数据模型与审计逻辑（核心）
- [ ] 定义 `CreativeBatchMetadata` 和 `CreativeCopyMetadata` 类型
- [ ] 实现 `auditCopies()` 函数（Worker 中）
- [ ] 实现审计提示词构建（`buildAuditPrompt()`）
- [ ] 实现审计结果解析（`parseAuditResponse()`）
- [ ] 实现 `applyAuditResult()` 更新文案状态

### Phase 2: API 扩展（后端）
- [ ] 扩展 `POST /api/creative/batches` 接受 topics/benchmarkCopy/auditConfig
- [ ] 扩展 `GET /api/creative/batches/:id` 返回审计结果
- [ ] 添加查询参数过滤推荐文案（`?recommended=true`）

### Phase 3: 前端改造（UI 交互）
- [ ] 批次创建表单：添加选题、对标、审计配置输入
- [ ] 批次详情：展示审计结果摘要卡片
- [ ] 文案卡片：显示推荐标记、理由、保留片段
- [ ] 资产管理页面：展示 REPORT/PROMPT 当前版本状态

### Phase 4: 手工录入流程（工具）
- [ ] 实现资产创建对话框（`CreateAssetDialog`）
- [ ] 实现资产历史版本查看（`AssetVersionHistory`）
- [ ] 实现资产激活切换（`ActivateAssetButton`）
- [ ] 文档说明：如何手工录入商家分析和提示词

### Phase 5: 测试与优化
- [ ] 单元测试：审计逻辑、提示词构建、结果解析
- [ ] 集成测试：完整批次生成+审计流程
- [ ] E2E 测试：前端创建批次 → Worker 执行 → 查看审计结果
- [ ] 性能优化：审计并发控制、缓存策略

## 5. 技术风险与应对

### 5.1 审计模型成本
**风险**：每个批次额外调用 1 次 AI，成本翻倍  
**应对**：
1. 默认启用审计，但允许用户关闭（`auditConfig.enabled = false`）
2. 使用更便宜的模型进行审计（如 Claude Haiku）
3. 缓存审计结果，避免重复评估

### 5.2 审计失败降级
**风险**：审计模型返回格式错误或调用失败  
**应对**：
1. 不影响主流程，审计失败时批次仍标记为 SUCCEEDED
2. 记录 GenerationException，但不阻塞文案保存
3. 前端容错：无审计结果时正常显示文案列表

### 5.3 元信息膨胀
**风险**：metadata 字段过大，影响查询性能  
**应对**：
1. 审计结果仅存储关键信息（推荐序号、理由、片段索引）
2. 原始模型输出存入 rawModelOutput（JSON 字段，不参与查询）
3. 考虑单独表存储审计历史（如需分析）

### 5.4 向后兼容
**风险**：旧批次无审计结果，前端展示异常  
**应对**：
1. 所有审计字段设为可选（`auditResult?: ...`）
2. 前端条件渲染：`{auditResult && <AuditCard />}`
3. 旧批次再生成时自动启用审计

## 6. 未来扩展

### 6.1 多轮对话改写
**场景**：用户对推荐文案不满意，直接在文案卡片中发起对话  
**实现**：
- 文案卡片添加"对话改写"按钮
- 路由跳转到 `/creative/conversations/new?copyId=xxx`
- 自动加载文案内容作为对话上下文

### 6.2 A/B 测试
**场景**：同时生成多个批次，对比审计结果  
**实现**：
- 批次列表支持多选和对比视图
- 展示不同选题/对标文案的推荐差异

### 6.3 自动化数据拉取
**场景**：API 接通后，自动拉取商家数据生成报告  
**实现**：
- 后台定时任务调用 TikHub API
- 自动生成或更新 REPORT 资产
- 通知用户"新数据已就绪，建议更新文案"

### 6.4 审计标准模板
**场景**：不同行业/场景的审计标准差异大  
**实现**：
- 预设审计标准模板（电商、餐饮、教育等）
- 用户选择模板或自定义
- 存储为 SystemConfig，支持复用

## 7. 总结

### 7.1 核心价值
1. **提升效率**：自动推荐最佳文案，减少人工筛选时间
2. **保留创意**：提取亮点片段，供二次创作参考
3. **灵活扩展**：支持选题、对标等多种生成场景
4. **向后兼容**：不影响现有批次和工作流

### 7.2 关键原则
1. **Linus 式哲学**：简单胜过复杂，能用就行
2. **渐进增强**：先实现核心审计流程，再扩展高级功能
3. **用户第一**：所有功能可选，不强制改变现有习惯
4. **数据驱动**：记录审计结果，供后续分析优化

### 7.3 成功指标
- [ ] 审计推荐准确率 > 80%（人工验证）
- [ ] 批次生成时间增加 < 20%（审计开销可接受）
- [ ] 用户满意度调查：审计功能有用性 > 4/5 分
- [ ] 90% 的批次启用审计（默认开启，用户接受度高）

---

**下一步行动**：
1. 讨论并确认技术方案细节
2. 开始 Phase 1 实施（审计逻辑核心）
3. 编写审计提示词并测试效果
4. 迭代优化审计标准
