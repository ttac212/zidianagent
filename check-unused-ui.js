const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('检查未使用的UI组件...\n');

const uiDir = path.join(__dirname, 'components', 'ui');
const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'));

const unused = [];
const used = [];

// 基础组件，总是保留
const keepAlways = ['button', 'input', 'textarea', 'error-boundary'];

files.forEach(file => {
  const componentName = file.replace('.tsx', '');

  if (keepAlways.includes(componentName)) {
    used.push(componentName);
    return;
  }

  try {
    // 使用ripgrep搜索引用
    const pattern = `from [\"']@/components/ui/${componentName}[\"']`;
    const result = execSync(`rg "${pattern}" --type tsx --type ts -l`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    // 过滤掉自引用
    const refs = result.split('\n').filter(line =>
      line && !line.includes(`components\\ui\\${componentName}.tsx`) &&
      !line.includes(`components/ui/${componentName}.tsx`)
    );

    if (refs.length === 0) {
      unused.push(componentName);
    } else {
      used.push(componentName);
    }
  } catch (e) {
    // 没找到引用
    unused.push(componentName);
  }
});

console.log('未使用的组件 (' + unused.length + '个):');
unused.forEach(c => console.log('  - ' + c));

console.log('\n正在使用的组件 (' + used.length + '个):');
used.forEach(c => console.log('  + ' + c));

console.log('\n删除命令:');
const deleteCmd = unused.map(c => `"components\\ui\\${c}.tsx"`).join(' ');
console.log('rm -f ' + deleteCmd);