/**
 * 验证批量转录对话框的逻辑修复
 * 检查组件代码是否正确实现了状态重置
 */

import * as fs from 'fs'
import * as path from 'path'

function verifyBatchTranscribeDialog() {
  console.log('🔍 验证批量转录对话框修复...\n')

  const filePath = path.join(process.cwd(), 'components/merchants/batch-transcribe-dialog.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  const checks = [
    {
      name: '移除了 RadioGroup 的 items.length === 0 条件限制',
      pattern: /转录模式选择[\s\S]*?\{!isTranscribing && \(/,
      shouldExist: true,
      shouldNotExist: /转录模式选择[\s\S]*?\{!isTranscribing && items\.length === 0 && \(/,
      description: 'RadioGroup 不再被 items.length === 0 限制'
    },
    {
      name: '添加了 handleOpenChange 函数',
      pattern: /const handleOpenChange.*=.*\(.*newOpen.*:.*boolean.*\).*=>/s,
      shouldExist: true,
      description: '新增了对话框关闭时的状态重置逻辑'
    },
    {
      name: '重置 items 状态',
      pattern: /setItems\(\[\]\)/,
      shouldExist: true,
      description: '对话框关闭时会重置 items 数组'
    },
    {
      name: '重置 progress 状态',
      pattern: /setProgress\(\{.*total:.*0.*processed:.*0/s,
      shouldExist: true,
      description: '对话框关闭时会重置 progress 状态'
    },
    {
      name: '使用 handleOpenChange 替代 setOpen',
      pattern: /onOpenChange=\{handleOpenChange\}/,
      shouldExist: true,
      description: 'Dialog 使用新的 handleOpenChange 函数'
    }
  ]

  let allPassed = true

  checks.forEach((check, index) => {
    const passed = check.shouldExist
      ? check.pattern.test(content)
      : !check.pattern.test(content)

    const shouldNotExistPassed = check.shouldNotExist
      ? !check.shouldNotExist.test(content)
      : true

    const finalPassed = passed && shouldNotExistPassed

    if (!finalPassed) allPassed = false

    const status = finalPassed ? '✅' : '❌'
    console.log(`${status} ${index + 1}. ${check.name}`)
    console.log(`   ${check.description}`)

    if (!finalPassed && check.shouldNotExist) {
      console.log(`   ⚠️  仍然存在不应该存在的模式`)
    }
  })

  console.log()

  if (allPassed) {
    console.log('✅ 批量转录对话框修复验证通过!')
    console.log('💡 用户现在可以:')
    console.log('   1. 随时切换转录模式（只要不在转录中）')
    console.log('   2. 每次打开对话框都会看到干净的界面')
    console.log('   3. 不会再出现"模式选择器消失"的问题')
  } else {
    console.log('❌ 发现问题，请检查代码修复')
    process.exit(1)
  }
}

verifyBatchTranscribeDialog()
