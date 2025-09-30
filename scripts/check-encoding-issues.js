const fs = require('fs')
const path = require('path')
const glob = require('glob')

// 检查文件编码和特殊字符
function checkFileEncoding(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const issues = []
    
    // 检查常见的编码问题字符
    const problematicPatterns = [
      { pattern: /[�]/g, description: '替换字符(乱码标志)' },
      { pattern: /[\uFFFD]/g, description: 'Unicode替换字符' },
      { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, description: '控制字符' },
      { pattern: /[\u0080-\u009F]/g, description: 'C1控制字符' },
      { pattern: /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, description: '不完整的代理对' },
      { pattern: /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, description: '孤立的低代理' },
      { pattern: /[âÃ¢ãÄäÅåÆæÇçÈèÉéÊêËëÌìÍíÎîÏïÐðÑñÒòÓóÔôÕõÖöØøÙùÚúÛûÜüÝýÞþÿ]/g, description: 'Latin-1编码错误' }
    ]
    
    // 检查每个模式
    problematicPatterns.forEach(({ pattern, description }) => {
      const matches = content.match(pattern)
      if (matches) {
        const uniqueMatches = [...new Set(matches)]
        uniqueMatches.forEach(match => {
          // 找到字符的位置
          const index = content.indexOf(match)
          const lineNumber = content.substring(0, index).split('\n').length
          const line = content.split('\n')[lineNumber - 1]
          
          // 获取上下文
          const contextStart = Math.max(0, index - 30)
          const contextEnd = Math.min(content.length, index + 30)
          const context = content.substring(contextStart, contextEnd)
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
          
          issues.push({
            file: filePath,
            line: lineNumber,
            char: match.charCodeAt(0).toString(16).toUpperCase(),
            description,
            context
          })
        })
      }
    })
    
    // 检查BOM标记
    if (content.charCodeAt(0) === 0xFEFF) {
      issues.push({
        file: filePath,
        line: 1,
        char: 'BOM',
        description: 'UTF-8 BOM标记',
        context: 'File starts with BOM'
      })
    }
    
    // 检查混合换行符
    const hasLF = content.includes('\n')
    const hasCRLF = content.includes('\r\n')
    if (hasLF && hasCRLF) {
      issues.push({
        file: filePath,
        line: 0,
        char: 'MIXED',
        description: '混合换行符(LF和CRLF)',
        context: 'File has mixed line endings'
      })
    }
    
    return issues
  } catch (error) {
    console.error(`无法读取文件 ${filePath}: ${error.message}`)
    return []
  }
}

// 主函数
async function main() {
  console.info('正在检查项目文件的编码问题...\n')
  
  // 要检查的文件类型
  const patterns = [
    'app/**/*.{tsx,ts,jsx,js}',
    'components/**/*.{tsx,ts,jsx,js}',
    'lib/**/*.{tsx,ts,jsx,js}',
    'hooks/**/*.{tsx,ts,jsx,js}',
    'types/**/*.{tsx,ts,jsx,js}'
  ]
  
  const allIssues = []
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**']
    })
    
    console.info(`检查 ${pattern} (${files.length} 个文件)...`)
    
    for (const file of files) {
      const issues = checkFileEncoding(file)
      if (issues.length > 0) {
        allIssues.push(...issues)
      }
    }
  }
  
  // 输出结果
  console.info('\n' + '='.repeat(80))
  
  if (allIssues.length === 0) {
    console.info('✅ 没有发现编码问题！')
  } else {
    console.info(`⚠️  发现 ${allIssues.length} 个潜在的编码问题：\n`)
    
    // 按文件分组
    const groupedIssues = {}
    allIssues.forEach(issue => {
      if (!groupedIssues[issue.file]) {
        groupedIssues[issue.file] = []
      }
      groupedIssues[issue.file].push(issue)
    })
    
    // 输出每个文件的问题
    Object.entries(groupedIssues).forEach(([file, issues]) => {
      console.info(`\n📄 ${file}:`)
      issues.forEach(issue => {
        if (issue.line > 0) {
          console.info(`   行 ${issue.line}: ${issue.description}`)
          console.info(`   字符编码: 0x${issue.char}`)
          console.info(`   上下文: "${issue.context}"`)
        } else {
          console.info(`   文件级问题: ${issue.description}`)
        }
      })
    })
  }
  
  console.info('\n' + '='.repeat(80))
}

// 运行主函数
main().catch(error => {
  console.error('检查过程中发生错误:', error)
  process.exit(1)
})