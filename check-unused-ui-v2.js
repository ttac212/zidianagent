const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('精确检查未使用的UI组件...\n');

const uiDir = path.join(__dirname, 'components', 'ui');
const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'));

const unused = [];
const used = [];

// 基础组件，保留
const keepAlways = ['button', 'input', 'textarea', 'error-boundary'];

files.forEach(file => {
  const componentName = file.replace('.tsx', '');

  if (keepAlways.includes(componentName)) {
    used.push(componentName);
    return;
  }

  try {
    // 使用ripgrep精确搜索
    const result = execSync(`rg "@/components/ui/${componentName}" --type ts --type tsx -l`, {
      encoding: 'utf8',
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    // 过滤自引用
    const refs = result.split('\n').filter(line => {
      const normalized = line.replace(/\\/g, '/');
      return line && !normalized.includes(`components/ui/${componentName}.tsx`);
    });

    if (refs.length === 0) {
      unused.push(componentName);
    } else {
      used.push(componentName);
    }
  } catch (e) {
    unused.push(componentName);
  }
});

console.log('未使用的组件 (' + unused.length + '个):');
unused.forEach(c => console.log('  - ' + c));

console.log('\n正在使用的组件 (' + used.length + '个):');
used.forEach(c => console.log('  + ' + c));

// 创建安全的删除脚本
if (unused.length > 0) {
  const deleteList = unused.map(c => path.join('components', 'ui', `${c}.tsx`));
  fs.writeFileSync('delete-unused-ui.txt', deleteList.join('\n'));
  console.log('\n未使用的组件列表已保存到: delete-unused-ui.txt');
}