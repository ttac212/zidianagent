#!/usr/bin/env node

/**
 * 批量清理未使用变量的脚本
 * 基于ESLint分析结果进行系统性修复
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  // 1. 未使用的NextRequest导入 (5个文件)
  {
    file: 'app/api/health/route.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },
  {
    file: 'app/api/invite-codes/create-test/route.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },
  {
    file: 'app/api/merchant-analysis/reports/route-simple.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },
  {
    file: 'app/api/merchant-analysis/reports/route.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },
  {
    file: 'app/api/merchant-analysis/reports/[id]/route.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },
  {
    file: 'lib/api/error-handler.ts',
    type: 'remove_import',
    pattern: /, NextRequest/g,
    replacement: ''
  },

  // 2. 未使用的error变量 (catch块) - 重命名为_error
  {
    file: 'app/api/conversations/[id]/route.ts',
    type: 'rename_catch_error',
    pattern: /} catch \(error\) \{/g,
    replacement: '} catch (_error) {'
  },
  {
    file: 'app/workspace/page.tsx',
    type: 'rename_catch_error',
    pattern: /} catch \(error\) \{/g,
    replacement: '} catch (_error) {'
  },
  {
    file: 'components/admin/key-management.tsx',
    type: 'rename_catch_error',
    pattern: /} catch \(error\) \{/g,
    replacement: '} catch (_error) {'
  },
  {
    file: 'components/admin/user-management.tsx',
    type: 'rename_catch_error',
    pattern: /} catch \(error\) \{/g,
    replacement: '} catch (_error) {'
  },
  {
    file: 'app/settings/enhanced-page.tsx',
    type: 'rename_catch_error',
    pattern: /} catch \(error\) \{/g,
    replacement: '} catch (_error) {'
  },
  {
    file: 'lib/utils/tag-parser.ts',
    type: 'rename_catch_error',
    pattern: /} catch \(secondError\) \{/g,
    replacement: '} catch (_secondError) {'
  },

  // 3. 未使用的request参数 - 重命名为_request
  {
    file: 'app/api/auth/verify-invite-code/route.ts',
    type: 'rename_param',
    pattern: /GET\(request: NextRequest\)/g,
    replacement: 'GET(_request: NextRequest)'
  },
  {
    file: 'app/api/keyword-data/route.ts',
    type: 'rename_param',
    pattern: /GET\(request: NextRequest\)/g,
    replacement: 'GET(_request: NextRequest)'
  }
];

console.log('🔧 开始系统性清理未使用变量...\n');

let fixedFiles = 0;
let totalFixes = 0;

fixes.forEach((fix, index) => {
  try {
    const filePath = path.join(process.cwd(), fix.file);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${fix.file}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 应用修复
    content = content.replace(fix.pattern, fix.replacement);

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ [${index + 1}/${fixes.length}] 修复: ${fix.file}`);
      console.log(`   类型: ${fix.type}`);
      fixedFiles++;
      totalFixes++;
    } else {
      console.log(`⚠️  [${index + 1}/${fixes.length}] 无需修改: ${fix.file}`);
    }

  } catch (error) {
    console.error(`❌ 修复失败 ${fix.file}:`, error.message);
  }
});

console.log(`\n📊 清理完成:`);
console.log(`   修复文件: ${fixedFiles}`);
console.log(`   总修复数: ${totalFixes}`);
console.log('\n🔍 建议运行 pnpm lint 验证结果');