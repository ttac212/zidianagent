#!/usr/bin/env node

/**
 * Linus式极速修复脚本
 * 修复所有系统性TypeScript错误
 */

const fs = require('fs');
const path = require('path');

// 获取所有TypeScript/JavaScript文件
function getAllTSFiles(dir = '.') {
  const files = [];

  function scan(currentDir) {
    if (currentDir.includes('node_modules') ||
        currentDir.includes('.next') ||
        currentDir.includes('.git')) {
      return;
    }

    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // 忽略访问错误
    }
  }

  scan(dir);
  return files;
}

// 修复单个文件
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let fixes = [];

  // 1. 修复NextRequest导入问题
  if (content.includes('NextRequest') &&
      content.includes('from "next/server"') &&
      !content.includes('NextRequest') ||
      (content.includes('import { NextResponse }') && !content.includes('NextRequest'))) {

    content = content.replace(
      /import { NextResponse } from "next\/server"/g,
      'import { NextResponse, NextRequest } from "next/server"'
    );

    content = content.replace(
      /import { NextResponse } from 'next\/server'/g,
      "import { NextResponse, NextRequest } from 'next/server'"
    );

    if (content !== originalContent) {
      fixes.push('Added NextRequest import');
    }
  }

  // 2. 修复 _error 但使用 error 的问题
  content = content.replace(
    /} catch \(_error\) \{[\s\S]*?void error/g,
    (match) => {
      fixes.push('Fixed _error/error mismatch');
      return match.replace('} catch (error) {', '} catch (error) {').replace('// error handled', '// error handled');
    }
  );

  // 3. 修复class-variance-authority导入
  if (content.includes('VariantProps') &&
      content.includes('from "class-variance-authority"') &&
      !content.includes('type VariantProps')) {

    content = content.replace(
      /import { cva } from "class-variance-authority"/g,
      'import { cva, type VariantProps } from "class-variance-authority"'
    );

    if (content !== originalContent) {
      fixes.push('Added VariantProps import');
    }
  }

  // 4. 修复React类型导入
  if (content.includes('ReactNode') &&
      content.includes('from "react"') &&
      !content.includes('ReactNode')) {

    content = content.replace(
      /import type React from "react"/g,
      'import type React, { ReactNode } from "react"'
    );

    if (content !== originalContent) {
      fixes.push('Added ReactNode import');
    }
  }

  // 5. 修复 _request 但使用 request 的问题
  content = content.replace(
    /\(_request: NextRequest\)/g,
    (match, offset) => {
      // 检查后面是否使用了request
      const afterMatch = content.substring(offset + match.length, offset + match.length + 500);
      if (afterMatch.includes('request.') || afterMatch.includes('request)')) {
        fixes.push('Fixed _request/request parameter mismatch');
        return '(request: NextRequest)';
      }
      return match;
    }
  );

  // 6. 修复 void _error 应该是 void error 的情况
  content = content.replace(/void _error/g, (match, offset) => {
    // 检查前面的catch语句
    const beforeMatch = content.substring(Math.max(0, offset - 100), offset);
    if (beforeMatch.includes('catch (_error)')) {
      fixes.push('Fixed void _error');
      return 'void _error';
    } else if (beforeMatch.includes('catch (error)')) {
      fixes.push('Fixed void error');
      return '// error handled';
    }
    return match;
  });

  // 保存修复后的文件
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${path.relative(process.cwd(), filePath)}: ${fixes.join(', ')}`);
    return fixes.length;
  }

  return 0;
}

// 主函数
function main() {
  console.log('🔧 Linus式TypeScript错误批量修复...\n');

  const files = getAllTSFiles();
  console.log(`扫描到 ${files.length} 个文件\n`);

  let totalFixes = 0;
  let fixedFiles = 0;

  for (const file of files) {
    try {
      const fixes = fixFile(file);
      if (fixes > 0) {
        totalFixes += fixes;
        fixedFiles++;
      }
    } catch (error) {
      console.error(`❌ 修复失败: ${file} - ${error.message}`);
    }
  }

  console.log(`\n📊 修复完成:`);
  console.log(`   修复文件: ${fixedFiles}`);
  console.log(`   总修复数: ${totalFixes}`);
  console.log(`\n运行 'pnpm type-check' 验证结果`);
}

if (require.main === module) {
  main();
}

module.exports = { fixFile, getAllTSFiles };