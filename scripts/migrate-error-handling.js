#!/usr/bin/env node

/**
 * API错误处理迁移脚本
 * 自动将传统的错误处理模式迁移到统一的createErrorResponse
 */

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

// 配置
const API_DIR = 'app/api'
const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

// 统计信息
let stats = {
  filesScanned: 0,
  filesNeedMigration: 0,
  filesMigrated: 0,
  catchBlocksFound: 0,
  catchBlocksMigrated: 0,
  errors: []
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m',   // 红色
    reset: '\x1b[0m'
  }
  
  if (VERBOSE || type !== 'info') {
    console.log(`${colors[type]}${message}${colors.reset}`)
  }
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    stats.filesScanned++
    
    // 检查是否已经使用了createErrorResponse
    const hasCreateErrorResponse = content.includes('createErrorResponse')
    const hasTraditionalErrorHandling = /} catch \(error\) \{[^}]*NextResponse\.json/.test(content)
    
    if (hasCreateErrorResponse) {
      log(`✅ ${filePath} - 已使用统一错误处理`, 'success')
      return { needsMigration: false, content }
    }
    
    if (!hasTraditionalErrorHandling) {
      log(`⚪ ${filePath} - 无需迁移`, 'info')
      return { needsMigration: false, content }
    }
    
    log(`🔄 ${filePath} - 需要迁移`, 'warning')
    stats.filesNeedMigration++
    
    return { needsMigration: true, content }
    
  } catch (error) {
    stats.errors.push(`读取文件失败: ${filePath} - ${error.message}`)
    return { needsMigration: false, content: null }
  }
}

function migrateFile(filePath, content) {
  let newContent = content
  let migrated = false
  
  // 1. 添加必要的导入
  if (!newContent.includes('createErrorResponse')) {
    // 找到最后一个import语句的位置
    const importLines = newContent.split('\n').filter(line => line.trim().startsWith('import'))
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1]
      const lastImportIndex = newContent.indexOf(lastImportLine) + lastImportLine.length
      
      const newImport = "\nimport { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'"
      newContent = newContent.slice(0, lastImportIndex) + newImport + newContent.slice(lastImportIndex)
      migrated = true
    }
  }
  
  // 2. 替换catch块
  const catchBlockPattern = /} catch \(error\) \{\s*return NextResponse\.json\(\s*\{ error: [^}]+ \},\s*\{ status: 500 \}\s*\)\s*}/g
  
  let match
  while ((match = catchBlockPattern.exec(newContent)) !== null) {
    stats.catchBlocksFound++
    const oldCatch = match[0]
    const newCatch = `} catch (error) {
    return createErrorResponse(error, generateRequestId())
  }`
    
    newContent = newContent.replace(oldCatch, newCatch)
    stats.catchBlocksMigrated++
    migrated = true
  }
  
  // 3. 处理更复杂的catch块模式
  const complexCatchPattern = /} catch \([^)]+\) \{\s*return NextResponse\.json\([^}]+\{ error: [^}]+\}[^}]+\{ status: \d+ \}[^}]+\)/g
  
  while ((match = complexCatchPattern.exec(newContent)) !== null) {
    stats.catchBlocksFound++
    const oldCatch = match[0]
    const newCatch = `} catch (error) {
    return createErrorResponse(error, generateRequestId())
  }`
    
    newContent = newContent.replace(oldCatch, newCatch)
    stats.catchBlocksMigrated++
    migrated = true
  }
  
  return { newContent, migrated }
}

async function migrateApiFiles() {
  log('🚀 开始API错误处理迁移...', 'info')
  log(`📁 扫描目录: ${API_DIR}`, 'info')
  log(`🔍 模式: ${DRY_RUN ? '预览模式 (不会修改文件)' : '实际迁移模式'}`, 'info')
  log('', 'info')
  
  try {
    // 获取所有API路由文件
    const pattern = path.join(API_DIR, '**', '*.ts').replace(/\\/g, '/')
    const files = await glob(pattern, { cwd: process.cwd() })
    
    log(`📄 找到 ${files.length} 个TypeScript文件`, 'info')
    log('', 'info')
    
    for (const file of files) {
      const { needsMigration, content } = analyzeFile(file)
      
      if (needsMigration && content) {
        const { newContent, migrated } = migrateFile(file, content)
        
        if (migrated) {
          if (!DRY_RUN) {
            fs.writeFileSync(file, newContent, 'utf8')
            log(`✅ ${file} - 迁移完成`, 'success')
          } else {
            log(`🔄 ${file} - 将会被迁移`, 'warning')
          }
          stats.filesMigrated++
        }
      }
    }
    
  } catch (error) {
    log(`❌ 迁移过程中出错: ${error.message}`, 'error')
    stats.errors.push(`迁移错误: ${error.message}`)
  }
}

function printSummary() {
  log('', 'info')
  log('📊 迁移统计报告:', 'info')
  log('==================', 'info')
  log(`📄 扫描文件数: ${stats.filesScanned}`, 'info')
  log(`🔄 需要迁移: ${stats.filesNeedMigration}`, 'warning')
  log(`✅ 已迁移: ${stats.filesMigrated}`, 'success')
  log(`🎯 catch块发现: ${stats.catchBlocksFound}`, 'info')
  log(`🎯 catch块迁移: ${stats.catchBlocksMigrated}`, 'success')
  
  if (stats.errors.length > 0) {
    log('', 'info')
    log('❌ 错误列表:', 'error')
    stats.errors.forEach(error => log(`  - ${error}`, 'error'))
  }
  
  log('', 'info')
  if (DRY_RUN) {
    log('💡 这是预览模式，没有实际修改文件', 'warning')
    log('💡 要执行实际迁移，请运行: node scripts/migrate-error-handling.js', 'warning')
  } else {
    log('🎉 迁移完成！建议运行测试验证功能正常', 'success')
  }
}

// 主函数
async function main() {
  await migrateApiFiles()
  printSummary()
}

// 执行
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { migrateApiFiles, stats }