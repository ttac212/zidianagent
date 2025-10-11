/**
 * 批量文案生成 Worker
 * 
 * 核心原则：
 * - 生成 5 条文案：SUCCEEDED
 * - 生成 1-4 条：PARTIAL_SUCCESS（部分成功）
 * - 生成 0 条：FAILED
 * 
 * 永远不要因为"少于 5 条"就扔掉已生成的内容。
 */

import { CreativeBatchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateBatchStatus } from '@/lib/repositories/creative-batch-repository'
import { selectApiKey } from '@/lib/ai/key-manager'

interface BatchWorkerInput {
  batchId: string
}

interface GeneratedCopy {
  sequence: number
  markdownContent: string
  rawModelOutput?: any
}

/**
 * Worker 主入口
 */
export async function processBatch(input: BatchWorkerInput): Promise<void> {
  const { batchId } = input

  // 结构化日志，生产环境可通过日志级别控制
  if (process.env.NODE_ENV === 'development') {
    console.log(`[BatchWorker] Processing batch ${batchId}`)
  }

  try {
    // 1. 更新状态为 RUNNING
    await updateBatchStatus({
      batchId,
      status: CreativeBatchStatus.RUNNING,
      startedAt: new Date()
    })

    // 2. 加载批次素材
    const materials = await loadBatchMaterials(batchId)

    // 3. 调用 AI 生成
    const result = await generateCopies(materials)

    // 4. 写入数据库（这会触发 statusVersion 更新，SSE 会推送）
    await saveCopies(batchId, result.copies)

    // 5. 决定最终状态（更新 statusVersion，SSE 再次推送）
    const targetSequence = typeof materials.metadata === 'object' && materials.metadata !== null && 'targetSequence' in materials.metadata
      ? (materials.metadata.targetSequence as number | undefined)
      : undefined
    const finalStatus = decideFinalStatus(result.copies.length, targetSequence)

    await updateBatchStatus({
      batchId,
      status: finalStatus,
      completedAt: new Date(),
      tokenUsage: result.tokenUsage,
      errorMessage: finalStatus === CreativeBatchStatus.PARTIAL_SUCCESS
        ? `仅生成 ${result.copies.length}/5 条文案，请检查输入材料或重新生成`
        : undefined
    })

    // 6. Linus: "别在正常情况下写垃圾日志"
    // 只有批量生成且不足 5 条时才记录异常，单条再生成不算异常
    if (targetSequence === undefined && result.copies.length < 5) {
      await recordGenerationException(batchId, result.copies.length, result.error)
    }

    console.log(`[BatchWorker] Batch ${batchId} completed with ${finalStatus}`)

  } catch (error: any) {
    console.error(`[BatchWorker] Batch ${batchId} failed:`, error)

    await updateBatchStatus({
      batchId,
      status: CreativeBatchStatus.FAILED,
      completedAt: new Date(),
      errorCode: error.code || 'UNKNOWN_ERROR',
      errorMessage: error.message
    })

    // 记录异常
    await prisma.generationException.create({
      data: {
        batchId,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorDetail: {
          message: error.message,
          stack: error.stack
        },
        status: 'OPEN'
      }
    })

    throw error
  }
}

/**
 * 决定最终状态
 * 
 * Linus 式原则：用户给我 5 条就 5 条，给我 3 条我也接受。
 * 只有 0 条才是真正的失败。
 * 
 * 特殊情况：单条再生成（targetSequence 存在）视为 SUCCEEDED
 */
function decideFinalStatus(copiesGenerated: number, targetSequence?: number): CreativeBatchStatus {
  // 单条再生成模式：只要生成了 1 条就是成功
  if (targetSequence !== undefined) {
    return copiesGenerated === 1 ? CreativeBatchStatus.SUCCEEDED : CreativeBatchStatus.FAILED
  }

  // 正常批量生成模式
  if (copiesGenerated === 5) {
    return CreativeBatchStatus.SUCCEEDED
  } else if (copiesGenerated > 0) {
    return CreativeBatchStatus.PARTIAL_SUCCESS
  } else {
    return CreativeBatchStatus.FAILED
  }
}

/**
 * 加载批次素材
 */
async function loadBatchMaterials(batchId: string) {
  const batch = await prisma.creativeBatch.findUnique({
    where: { id: batchId },
    include: {
      assets: {
        include: {
          promptAsset: true,
          referenceAsset: true
        }
      }
    }
  })

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`)
  }

  // 提取素材内容
  const report = batch.assets.find(a => a.role === 'REPORT')?.promptAsset?.content
  const prompt = batch.assets.find(a => a.role === 'PROMPT')?.promptAsset?.content
  const attachments = batch.assets
    .filter(a => a.role === 'ATTACHMENT' && a.isEnabled)
    .map(a => a.referenceAsset)
    .filter(Boolean)

  if (!report || !prompt) {
    throw new Error(`Batch ${batchId} missing required REPORT or PROMPT assets`)
  }

  return {
    batchId: batch.id,
    merchantId: batch.merchantId,
    modelId: batch.modelId,
    metadata: batch.metadata,
    report,
    prompt,
    attachments
  }
}

/**
 * 调用 AI 生成文案
 */
async function generateCopies(materials: any): Promise<{
  copies: GeneratedCopy[]
  tokenUsage: any
  error?: string
}> {
  const { modelId, report, prompt, attachments, metadata } = materials

  // 检查是否为单条再生成模式（安全访问 JSON 类型的 metadata）
  const targetSequence = typeof metadata === 'object' && metadata !== null && 'targetSequence' in metadata
    ? (metadata.targetSequence as number | undefined)
    : undefined
  const editedContent = typeof metadata === 'object' && metadata !== null && 'editedContent' in metadata
    ? (metadata.editedContent as string | undefined)
    : undefined

  console.log('[BatchWorker] Generating copies with model:', modelId)
  if (targetSequence !== undefined) {
    console.log(`[BatchWorker] Single copy regeneration mode: sequence ${targetSequence}`)
  }

  // 1. 构建提示词
  const systemPrompt = buildSystemPrompt(targetSequence)
  const userPrompt = buildUserPrompt(report, prompt, attachments, metadata, editedContent)

  // 2. 调用 Claude API
  const { apiKey, provider } = selectApiKey(modelId)
  
  if (!apiKey) {
    throw new Error(`No API key available for model ${modelId} (provider: ${provider})`)
  }

  const API_BASE = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

  const requestBody = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.8,
    max_tokens: 8000,
    stream: false // Worker 不需要流式响应
  }

  console.log('[BatchWorker] Calling AI API...')

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API error (${response.status}): ${errorText}`)
  }

  const result = await response.json()

  // 3. 提取 token 使用量
  const tokenUsage = {
    prompt: result.usage?.prompt_tokens || 0,
    completion: result.usage?.completion_tokens || 0,
    total: result.usage?.total_tokens || 0
  }

  // 4. 解析响应内容
  const content = result.choices?.[0]?.message?.content || ''

  if (!content) {
    throw new Error('AI returned empty content')
  }

  // 5. 解析文案
  const parseResult = parseCopiesFromContent(content, targetSequence)

  const expectedCount = targetSequence !== undefined ? 1 : 5
  console.log(`[BatchWorker] Generated ${parseResult.copies.length}/${expectedCount} copies`)

  // Linus: "用户需要知道为什么失败，而不是看到 '0 条文案'"
  if (parseResult.copies.length === 0) {
    const modeHint = targetSequence !== undefined 
      ? `单条再生成模式（序号 ${targetSequence}）` 
      : '批量生成模式（需要 5 条）'
    const hint = targetSequence !== undefined
      ? `模型未返回序号 ${targetSequence} 的文案，请检查模型输出格式是否正确。`
      : '模型未返回任何可解析的文案，请检查输入材料或模型输出。'
    
    throw new Error(
      `${modeHint}解析失败：${hint}\n\n` +
      `原始内容：${content.substring(0, 500)}...`
    )
  }

  return {
    copies: parseResult.copies,
    tokenUsage,
    error: parseResult.error
  }
}

/**
 * 保存文案到数据库
 */
async function saveCopies(batchId: string, copies: GeneratedCopy[]): Promise<void> {
  console.log(`[BatchWorker] Saving ${copies.length} copies for batch ${batchId}`)

  await prisma.$transaction(async tx => {
    for (const copy of copies) {
      const createdCopy = await tx.creativeCopy.create({
        data: {
          batchId,
          sequence: copy.sequence,
          markdownContent: copy.markdownContent,
          rawModelOutput: copy.rawModelOutput,
          state: 'DRAFT',
          contentVersion: 1
        }
      })

      // 创建初始版本记录
      await tx.creativeCopyRevision.create({
        data: {
          copyId: createdCopy.id,
          version: 1,
          content: copy.markdownContent,
          source: 'MODEL',
          createdBy: 'system'
        }
      })
    }
  })
}

/**
 * 记录生成异常（但不影响已生成的内容）
 */
async function recordGenerationException(
  batchId: string,
  copiesGenerated: number,
  errorMessage?: string
): Promise<void> {
  await prisma.generationException.create({
    data: {
      batchId,
      errorCode: 'INCOMPLETE_GENERATION',
      errorDetail: {
        expected: 5,
        actual: copiesGenerated,
        message: errorMessage || '模型未能生成完整的 5 条文案'
      },
      status: 'OPEN'
    }
  })
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(targetSequence?: number): string {
  if (targetSequence !== undefined) {
    // 单条再生成模式
    return `你是一个专业的短视频文案创作专家。

你的任务是根据商家分析报告、提示词模板和参考资料，生成 1 条短视频文案。

输出要求：
1. 生成 1 条独立文案
2. 使用以下格式：
   ===COPY-${targetSequence}===
   [文案内容]

3. 文案要求：
   - 使用 Markdown 格式
   - 包含标题、正文、结尾行动号召
   - 适合短视频配音（60-90秒）
   - 口语化、有感染力
   - 符合商家定位和目标受众

4. 如果用户提供了原有文案，根据用户的补充要求进行改进`
  }

  // 批量生成模式
  return `你是一个专业的短视频文案创作专家。

你的任务是根据商家分析报告、提示词模板和参考资料，生成 5 条短视频文案。

输出要求：
1. 严格生成 5 条文案，每条文案独立成篇
2. 使用以下格式分隔每条文案：
   ===COPY-1===
   [第一条文案内容]
   
   ===COPY-2===
   [第二条文案内容]
   
   ===COPY-3===
   [第三条文案内容]
   
   ===COPY-4===
   [第四条文案内容]
   
   ===COPY-5===
   [第五条文案内容]

3. 每条文案应该：
   - 使用 Markdown 格式
   - 包含标题、正文、结尾行动号召
   - 适合短视频配音（60-90秒）
   - 口语化、有感染力
   - 符合商家定位和目标受众

4. 5 条文案应该有不同的切入点和风格，避免重复`
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(
  report: string,
  promptTemplate: string,
  attachments: any[],
  metadata?: any,
  editedContent?: string
): string {
  let userPrompt = `# 商家分析报告

${report}

# 提示词模板

${promptTemplate}`

  // 添加附件内容
  if (attachments && attachments.length > 0) {
    userPrompt += '\n\n# 参考资料\n'
    attachments.forEach((att, index) => {
      const text = att.summary || att.originalText || att.ocrText
      if (text) {
        userPrompt += `\n## 资料 ${index + 1}\n${text}\n`
      }
    })
  }

  // 如果是单条再生成且有用户编辑的内容
  if (editedContent) {
    userPrompt += `\n\n# 原有文案（用户已编辑）\n${editedContent}`
  }

  // 如果有补充提示（单条再生成时）
  const appendPrompt = typeof metadata === 'object' && metadata !== null && 'appendPrompt' in metadata
    ? (metadata.appendPrompt as string | undefined)
    : undefined
  if (appendPrompt) {
    userPrompt += `\n\n# 补充要求\n${appendPrompt}`
  }

  // 根据模式调整结尾
  const targetSeq = typeof metadata === 'object' && metadata !== null && 'targetSequence' in metadata
    ? (metadata.targetSequence as number | undefined)
    : undefined
  if (targetSeq !== undefined) {
    userPrompt += `\n\n请根据以上信息，针对序号 ${targetSeq} 生成 1 条改进的短视频文案。`
    if (editedContent) {
      userPrompt += '\n注意：请基于用户编辑的原有文案进行改进，保持风格一致但优化表达。'
    }
  } else {
    userPrompt += '\n\n请根据以上信息，生成 5 条短视频文案。'
  }

  return userPrompt
}

/**
 * 解析 AI 返回的文案内容
 * 
 * Linus 式原则：能解析出多少就返回多少，不要因为"不完美"就全部丢弃
 * 
 * @param targetSequence 单条再生成模式时的目标序号
 */
function parseCopiesFromContent(
  content: string,
  targetSequence?: number
): {
  copies: GeneratedCopy[]
  error?: string
} {
  const copies: GeneratedCopy[] = []
  const errors: string[] = []

  // 尝试按分隔符解析
  const pattern = /===COPY-(\d+)===[\s\S]*?([\s\S]*?)(?===COPY-\d+===|$)/g
  let match

  while ((match = pattern.exec(content)) !== null) {
    const sequence = parseInt(match[1])
    const copyContent = match[2].trim()

    // 验证序号范围
    const isValidSequence = sequence >= 1 && sequence <= 5
    
    // 单条再生成模式：只接受目标序号
    if (targetSequence !== undefined && sequence !== targetSequence) {
      continue // 跳过非目标序号的文案
    }

    if (isValidSequence && copyContent) {
      copies.push({
        sequence,
        markdownContent: copyContent,
        rawModelOutput: { 
          originalSequence: sequence,
          regenerationMode: targetSequence !== undefined
        }
      })
    } else {
      errors.push(`Invalid copy ${sequence}: empty or out of range`)
    }
  }

  // 如果按格式解析失败，尝试简单分段（容错）
  if (copies.length === 0) {
    console.warn('[BatchWorker] Failed to parse with delimiter, trying simple split')
    
    // 尝试按段落分割
    const paragraphs = content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 50) // 至少 50 字符才算有效文案

    if (targetSequence !== undefined) {
      const first = paragraphs[0]
      if (first) {
        copies.push({
          sequence: targetSequence,
          markdownContent: first,
          rawModelOutput: { fallbackParsed: true, regenerationMode: true }
        })
      }
    } else {
      paragraphs.slice(0, 5).forEach((para, index) => {
        copies.push({
          sequence: index + 1,
          markdownContent: para,
          rawModelOutput: { fallbackParsed: true }
        })
      })
    }

    if (copies.length > 0) {
      errors.push(`格式解析失败，使用段落分割提取到 ${copies.length} 条`)
    }
  }

  // 按 sequence 排序
  copies.sort((a, b) => a.sequence - b.sequence)

  return {
    copies,
    error: errors.length > 0 ? errors.join('; ') : undefined
  }
}
