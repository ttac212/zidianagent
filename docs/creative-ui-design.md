# 批量文案生成 - 前端界面设计方案

## 设计原则

遵循项目现有设计风格：
- **shadcn/ui** 组件库
- **Card** 卡片式布局
- **响应式设计**（移动端折叠/Drawer）
- **清晰的信息层级**
- **一致的交互模式**

## 一、资料管理界面

### 1.1 页面路由

```
/creative/merchants/:merchantId/assets
```

### 1.2 布局结构

```
┌─────────────────────────────────────────┐
│ Header (sticky)                         │
├─────────────────────────────────────────┤
│ Container                               │
│ ┌─────────────────────────────────────┐ │
│ │ 标题栏 + 操作按钮                    │ │
│ ├─────────────────────────────────────┤ │
│ │ Tabs: 商家报告 | 提示词模板 | 附件  │ │
│ ├─────────────────────────────────────┤ │
│ │ 版本列表 (Card)                      │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ 版本卡片 1 (当前版本 Badge)      │ │ │
│ │ │ - 标题                           │ │ │
│ │ │ - 版本号 | 创建时间               │ │ │
│ │ │ - 内容预览                       │ │ │
│ │ │ - [编辑] [查看] [设为当前]       │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ 版本卡片 2...                        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 1.3 组件设计

#### AssetTabs 组件
```typescript
<Tabs defaultValue="report">
  <TabsList>
    <TabsTrigger value="report">商家报告</TabsTrigger>
    <TabsTrigger value="prompt">提示词模板</TabsTrigger>
    <TabsTrigger value="attachment">附件素材</TabsTrigger>
  </TabsList>

  <TabsContent value="report">
    <AssetVersionList type="REPORT" />
  </TabsContent>
  ...
</Tabs>
```

#### AssetVersionCard 组件
```typescript
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2">
        {title}
        {isActive && <Badge variant="success">当前版本</Badge>}
      </CardTitle>
      <div className="text-sm text-muted-foreground">
        v{version}
      </div>
    </div>
    <CardDescription>
      创建于 {formatDate(createdAt)} | 创建人: {createdBy}
    </CardDescription>
  </CardHeader>
  
  <CardContent>
    <div className="text-sm line-clamp-3 text-muted-foreground mb-4">
      {contentPreview}
    </div>
    
    <div className="flex gap-2">
      <Button variant="outline" size="sm">
        <Eye className="mr-1 h-4 w-4" />
        查看
      </Button>
      <Button variant="outline" size="sm">
        <Edit className="mr-1 h-4 w-4" />
        编辑
      </Button>
      {!isActive && (
        <Button variant="default" size="sm">
          设为当前版本
        </Button>
      )}
    </div>
  </CardContent>
</Card>
```

#### CreateAssetDialog 组件
```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      新建{assetTypeLabel}
    </Button>
  </DialogTrigger>
  
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>创建新{assetTypeLabel}</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      <Input label="标题" />
      <Textarea 
        label="内容" 
        rows={12}
        placeholder="输入内容..."
      />
      <Switch label="设为当前版本" />
    </div>
    
    <DialogFooter>
      <Button variant="outline">取消</Button>
      <Button>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 1.4 附件特殊处理

附件标签页显示：
- 文件名
- 上传时间
- 原始文本 / OCR 文本 / 摘要
- 启用状态开关（用于批次创建时选择）
- 预览/下载/删除操作

```typescript
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5" />
        <CardTitle>{fileName}</CardTitle>
      </div>
      <Switch checked={isDefaultEnabled} />
    </div>
  </CardHeader>
  
  <CardContent>
    <Tabs defaultValue="original">
      <TabsList>
        <TabsTrigger value="original">原始文本</TabsTrigger>
        <TabsTrigger value="ocr">OCR</TabsTrigger>
        <TabsTrigger value="summary">摘要</TabsTrigger>
      </TabsList>
      
      <TabsContent value="original">
        <pre className="text-sm whitespace-pre-wrap">
          {originalText}
        </pre>
      </TabsContent>
      ...
    </Tabs>
  </CardContent>
</Card>
```

## 二、文案详情与编辑页面

### 2.1 页面路由

```
/creative/batches/:batchId
```

### 2.2 布局结构

```
┌──────────────────────────────────────────────┐
│ Header (sticky)                              │
├──────────────────────────────────────────────┤
│ Container                                    │
│ ┌────────────────────────────────────────┐   │
│ │ 面包屑导航                              │   │
│ │ 批次列表 > 批次详情                     │   │
│ ├────────────────────────────────────────┤   │
│ │ 批次信息卡片 (Card)                     │   │
│ │ - 状态 Badge + copyCount               │   │
│ │ - 模型 | 创建时间 | Token用量           │   │
│ │ - [整批重新生成] 按钮                   │   │
│ ├────────────────────────────────────────┤   │
│ │ 文案列表 (Grid 2x3 或 1x5)              │   │
│ │ ┌──────────────┐ ┌──────────────┐      │   │
│ │ │ 文案卡片 1   │ │ 文案卡片 2   │      │   │
│ │ │ Markdown预览 │ │ Markdown预览 │      │   │
│ │ │ [复制][编辑] │ │ [复制][编辑] │      │   │
│ │ │ [再生成]     │ │ [再生成]     │      │   │
│ │ └──────────────┘ └──────────────┘      │   │
│ │ ...                                     │   │
│ └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### 2.3 组件设计

#### BatchInfoCard 组件
```typescript
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BatchStatusBadge 
          status={batch.status} 
          copyCount={batch.copyCount}
        />
        <code className="text-sm text-muted-foreground">
          {batch.id}
        </code>
      </div>
      
      <Button variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        整批重新生成
      </Button>
    </div>
  </CardHeader>
  
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <div className="text-sm text-muted-foreground">模型</div>
        <div className="text-sm font-medium">{modelId}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">创建时间</div>
        <div className="text-sm">{formatDate(createdAt)}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Token用量</div>
        <div className="text-sm">{tokenUsage.total}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">文案数量</div>
        <div className="text-sm">{copyCount}/5</div>
      </div>
    </div>
  </CardContent>
</Card>
```

#### CopyCard 组件
```typescript
<Card className="relative group">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-base">
        文案 {sequence}
      </CardTitle>
      <Badge variant={getStateVariant(state)}>
        {STATE_LABELS[state]}
      </Badge>
    </div>
  </CardHeader>
  
  <CardContent>
    {/* Markdown 预览 */}
    <div className="prose prose-sm max-w-none mb-4">
      <SecureMarkdown content={markdownContent} />
    </div>
    
    <Separator className="my-4" />
    
    {/* 操作按钮 */}
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => copyToClipboard(markdownContent)}
      >
        <Copy className="mr-1 h-4 w-4" />
        复制
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setEditingCopyId(id)}
      >
        <Edit className="mr-1 h-4 w-4" />
        编辑
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => handleRegenerate(id)}
      >
        <RefreshCw className="mr-1 h-4 w-4" />
        单条重新生成
      </Button>
      
      {/* 状态切换 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => updateState('APPROVED')}>
            标记为通过
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateState('REJECTED')}>
            标记为拒绝
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => viewHistory()}>
            查看版本历史
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </CardContent>
</Card>
```

#### CopyEditDialog 组件
```typescript
<Dialog open={editingCopyId !== null}>
  <DialogContent className="max-w-4xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>编辑文案 {sequence}</DialogTitle>
      <DialogDescription>
        修改后将创建新版本（v{contentVersion + 1}）
      </DialogDescription>
    </DialogHeader>
    
    <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
      {/* 左侧：编辑器 */}
      <div className="flex flex-col">
        <Label>Markdown 编辑</Label>
        <Textarea 
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="flex-1 font-mono text-sm"
          rows={20}
        />
      </div>
      
      {/* 右侧：预览 */}
      <div className="flex flex-col">
        <Label>预览</Label>
        <div className="flex-1 border rounded-md p-4 overflow-auto">
          <div className="prose prose-sm max-w-none">
            <SecureMarkdown content={editContent} />
          </div>
        </div>
      </div>
    </div>
    
    <div className="space-y-2">
      <Label>修改说明（可选）</Label>
      <Input 
        placeholder="简要说明修改原因..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={handleCancel}>
        取消
      </Button>
      <Button onClick={handleSave}>
        保存修改
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 三、再生成功能

### 3.1 整批重新生成

**触发位置**：批次详情页的批次信息卡片

**交互流程**：
1. 点击"整批重新生成"按钮
2. 弹出Dialog确认
3. 可选：添加补充提示词
4. 创建新批次，复制原批次资产配置
5. 跳转到新批次页面，显示SSE实时状态

```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">
      <RefreshCw className="mr-2 h-4 w-4" />
      整批重新生成
    </Button>
  </DialogTrigger>
  
  <DialogContent>
    <DialogHeader>
      <DialogTitle>整批重新生成</DialogTitle>
      <DialogDescription>
        将基于当前批次的资产配置重新生成 5 条文案
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* 显示原批次信息 */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="text-sm font-medium">原批次</div>
        <div className="text-sm text-muted-foreground">
          ID: {batch.id}
        </div>
        <div className="text-sm text-muted-foreground">
          生成数量: {batch.copyCount}/5
        </div>
      </div>
      
      {/* 补充提示词 */}
      <div>
        <Label>补充提示词（可选）</Label>
        <Textarea 
          placeholder="例如：强调优惠信息、更口语化..."
          value={appendPrompt}
          onChange={(e) => setAppendPrompt(e.target.value)}
          rows={3}
        />
      </div>
      
      {/* Token 估算 */}
      <div className="text-sm text-muted-foreground">
        预计消耗 Token: ~3000
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={handleCancel}>
        取消
      </Button>
      <Button onClick={handleRegenerateAll} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        开始生成
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 3.2 单条重新生成

**触发位置**：文案卡片的操作按钮

**交互流程**：
1. 点击"单条重新生成"
2. 弹出Dialog，显示当前文案
3. 可选：基于当前内容编辑 / 添加补充提示
4. 创建新批次（metadata 标记 source: 'copy-regenerate'）
5. 生成完成后更新 UI，显示新文案

```typescript
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <RefreshCw className="mr-1 h-4 w-4" />
      单条重新生成
    </Button>
  </DialogTrigger>
  
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>单条重新生成 - 文案 {sequence}</DialogTitle>
      <DialogDescription>
        基于原批次资产重新生成这条文案
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* 当前内容预览 */}
      <div>
        <Label>当前内容</Label>
        <div className="mt-2 rounded-lg border p-4 max-h-48 overflow-auto">
          <div className="prose prose-sm max-w-none">
            <SecureMarkdown content={currentContent} />
          </div>
        </div>
      </div>
      
      {/* 选项：基于当前内容 or 完全重新生成 */}
      <RadioGroup value={mode} onValueChange={setMode}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="based-on-current" id="based" />
          <Label htmlFor="based">
            基于当前内容改进
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="fresh" id="fresh" />
          <Label htmlFor="fresh">
            完全重新生成
          </Label>
        </div>
      </RadioGroup>
      
      {/* 补充提示 */}
      <div>
        <Label>补充要求</Label>
        <Textarea 
          placeholder="例如：更突出产品特点、调整语气..."
          value={appendPrompt}
          onChange={(e) => setAppendPrompt(e.target.value)}
          rows={3}
        />
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={handleCancel}>
        取消
      </Button>
      <Button onClick={handleRegenerateSingle} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        重新生成
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 四、响应式设计

### 移动端适配

- **资料管理**：Tabs 改为 Accordion 或垂直堆叠
- **文案列表**：Grid 改为单列布局
- **编辑器**：上下分栏改为Tab切换（编辑/预览）
- **操作按钮**：收缩到 DropdownMenu

示例：
```typescript
// 桌面端
<div className="hidden md:grid grid-cols-2 gap-4">
  <Textarea />
  <Preview />
</div>

// 移动端
<div className="md:hidden">
  <Tabs>
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="edit">编辑</TabsTrigger>
      <TabsTrigger value="preview">预览</TabsTrigger>
    </TabsList>
    <TabsContent value="edit"><Textarea /></TabsContent>
    <TabsContent value="preview"><Preview /></TabsContent>
  </Tabs>
</div>
```

## 五、加载与错误状态

### 加载状态

使用 Skeleton 组件：
```typescript
{loading ? (
  <>
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </>
) : (
  <AssetList assets={assets} />
)}
```

### 错误状态

使用 Alert 组件：
```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>加载失败</AlertTitle>
    <AlertDescription>
      {error.message}
      <Button 
        variant="outline" 
        size="sm" 
        className="ml-4"
        onClick={retry}
      >
        重试
      </Button>
    </AlertDescription>
  </Alert>
)}
```

### SSE 连接状态

```typescript
{isConnected ? (
  <Badge variant="success" className="animate-pulse">
    <WifiIcon className="mr-1 h-3 w-3" />
    实时连接
  </Badge>
) : (
  <Badge variant="secondary">
    已断开
  </Badge>
)}
```

## 六、实现优先级

### P0 - 核心功能
1. ✅ 批次列表页（已完成）
2. **批次详情页**（文案查看 + 编辑）
3. **单条重新生成**（基础对话框）

### P1 - 完整体验
4. **资料管理页**（查看 + 创建版本）
5. **整批重新生成**
6. 文案版本历史查看

### P2 - 优化增强
7. 资料编辑功能
8. 附件上传功能
9. 批次归档/删除
10. 导出功能

## 七、技术栈

- **UI 组件**: shadcn/ui（Card, Dialog, Tabs, Badge, Button, Input, Textarea 等）
- **Markdown**: `SecureMarkdown` 组件（已有）
- **状态管理**: React hooks + React Query
- **SSE**: `useBatchStatusSSE` hook（已实现）
- **Toast**: Sonner
- **图标**: lucide-react

## 八、文件组织

```
app/creative/
  batches/
    page.tsx                      # 批次列表（已完成）
    [batchId]/
      page.tsx                    # 批次详情 + 文案展示
      
  merchants/
    [merchantId]/
      assets/
        page.tsx                  # 资料管理

components/creative/
  batch-status-badge.tsx          # 状态徽章（已完成）
  batch-info-card.tsx             # 批次信息卡片
  copy-card.tsx                   # 文案卡片
  copy-edit-dialog.tsx            # 文案编辑对话框
  copy-regenerate-dialog.tsx      # 单条重新生成对话框
  batch-regenerate-dialog.tsx     # 整批重新生成对话框
  asset-tabs.tsx                  # 资料管理Tabs
  asset-version-card.tsx          # 版本卡片
  create-asset-dialog.tsx         # 创建资料对话框
```

---

**设计原则总结**：
- 保持与现有页面（workspace, merchants）的一致性
- 使用项目已有的组件和模式
- 移动端友好
- 清晰的信息层级
- 即时反馈（Toast, SSE）
