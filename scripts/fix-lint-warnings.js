#!/usr/bin/env node

/**
 * 批量修复未使用的变量警告
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') &&
          !fullPath.includes('.next') &&
          !fullPath.includes('.git')) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// 获取所有需要处理的文件
const filesToProcess = [
  ...getAllFiles('./app'),
  ...getAllFiles('./components'),
  ...getAllFiles('./lib'),
  ...getAllFiles('./hooks'),
].filter(f => !f.includes('.d.ts'));

let totalFixed = 0;
const fixedFiles = [];

filesToProcess.forEach((file) => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    let fileFixed = false;

    // 1. 修复 catch (error) -> catch (_error)
    // 只修复那些真正未使用的error
    content = content.replace(/\} catch \((error|err|e)\) \{/g, (match, errorVar) => {
      // 读取catch块的内容
      const afterCatch = content.substring(content.indexOf(match) + match.length);
      const blockEnd = afterCatch.indexOf('} catch') !== -1 ?
        Math.min(afterCatch.indexOf('} catch'), afterCatch.indexOf('\n}')) :
        afterCatch.indexOf('\n}');
      const blockContent = afterCatch.substring(0, blockEnd);

      // 检查是否使用了error变量（排除void语句）
      const errorUsed = new RegExp(`(?<!void )\\b${errorVar}\\b`, 'g');
      if (!errorUsed.test(blockContent)) {
        fileFixed = true;
        totalFixed++;
        return `} catch (_${errorVar}) {`;
      }
      return match;
    });

    // 2. 修复API路由中未使用的request参数
    content = content.replace(
      /export async function (GET|POST|PUT|PATCH|DELETE)\((request|req): NextRequest/g,
      (match, method, paramName) => {
        // 检查函数体中是否使用了request
        const funcPattern = new RegExp(`export async function ${method}\\([^)]+\\)[^{]*{([^}]|\\n)*?^}`, 'gm');
        const funcMatch = content.match(funcPattern);
        if (funcMatch && !funcMatch[0].includes(paramName + '.')) {
          fileFixed = true;
          return `export async function ${method}(_${paramName}: NextRequest`;
        }
        return match;
      }
    );

    // 3. 修复未使用的解构参数
    content = content.replace(
      /const \{ ([^}]+) \} = ([^;]+);/g,
      (match, destructured, source) => {
        const vars = destructured.split(',').map(v => v.trim().split(':')[0].trim());
        const unusedVars = vars.filter(v => {
          // 检查变量是否在后续代码中使用
          const afterDeclaration = content.substring(content.indexOf(match) + match.length);
          const varUsed = new RegExp(`\\b${v}\\b`);
          return !varUsed.test(afterDeclaration.substring(0, 1000)); // 检查接下来1000个字符
        });

        if (unusedVars.length > 0 && unusedVars.length < vars.length) {
          // 有部分未使用的变量，给它们加下划线
          let newDestructured = destructured;
          unusedVars.forEach(v => {
            newDestructured = newDestructured.replace(new RegExp(`\\b${v}\\b`), `_${v}`);
          });
          fileFixed = true;
          return `const { ${newDestructured} } = ${source};`;
        }
        return match;
      }
    );

    // 保存修改
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      fixedFiles.push(file);
      console.info(`✅ Fixed: ${path.relative(process.cwd(), file)}`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${file}:`, err.message);
  }
});

console.info('\n📊 Summary:');
console.info(`   Total files scanned: ${filesToProcess.length}`);
console.info(`   Files modified: ${fixedFiles.length}`);
console.info(`   Total fixes applied: ${totalFixed}`);

if (fixedFiles.length > 0) {
  console.info('\n📝 Modified files:');
  fixedFiles.forEach(f => console.info(`   - ${path.relative(process.cwd(), f)}`));
}