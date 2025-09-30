#!/usr/bin/env node

/**
 * 修复所有未使用的error变量
 * 将 catch (error) 改为 catch (_error)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 查找所有TypeScript文件
const files = glob.sync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', '.next/**', 'dist/**'],
});

let totalFixed = 0;

files.forEach((file) => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // 修复 catch (error) 中未使用的error
    // 但保留那些真正使用了error的catch块
    const catchPattern = /} catch \((error|err|e)\) {([^}]*?)}/gs;

    content = content.replace(catchPattern, (match, errorVar, blockContent) => {
      // 检查error变量是否在块中被使用
      const errorUsedPattern = new RegExp(`\\b${errorVar}\\b`, 'g');
      const usageMatches = blockContent.match(errorUsedPattern);

      // 如果error变量没有被使用（或只在void语句中），添加下划线前缀
      if (!usageMatches || (usageMatches.length === 1 && blockContent.includes(`void ${errorVar}`))) {
        totalFixed++;
        return `} catch (_${errorVar}) {${blockContent}}`;
      }

      return match;
    });

    // 修复未使用的函数参数（常见于API路由）
    // NextRequest经常不使用
    content = content.replace(
      /export async function (GET|POST|PUT|PATCH|DELETE)\(request: NextRequest/g,
      'export async function $1(_request: NextRequest'
    );

    // 保存修改
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.info(`✅ Fixed: ${file}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${file}:`, err.message);
  }
});

console.info(`\n✨ Total fixes applied: ${totalFixed}`);