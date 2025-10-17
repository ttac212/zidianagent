/**
 * 一键配置检查脚本
 * 验证抖音文案提取功能的所有依赖和配置
 *
 * 运行: npm run check:douyin
 * 或: npx tsx scripts/check-douyin-setup.ts
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

console.log('🔍 抖音文案提取功能 - 配置检查\n');
console.log('='.repeat(60) + '\n');

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  fix?: string;
}

const results: CheckResult[] = [];

async function check(
  name: string,
  testFn: () => Promise<boolean>,
  successMsg: string,
  failMsg: string,
  fix?: string
) {
  try {
    const passed = await testFn();
    results.push({
      name,
      status: passed ? 'pass' : 'fail',
      message: passed ? successMsg : failMsg,
      fix,
    });
  } catch (error) {
    results.push({
      name,
      status: 'fail',
      message: failMsg,
      fix,
    });
  }
}

async function main() {
  // 1. 检查环境变量
  console.log('1️⃣ 检查环境变量配置...');
  await check(
    'DOUBAO_ASR_API_KEY',
    async () => !!(process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY),
    'API Key已配置',
    'API Key未配置',
    '在.env.local中添加: DOUBAO_ASR_API_KEY=your-api-key'
  );

  await check(
    'DOUBAO_ASR_API_URL',
    async () => !!process.env.DOUBAO_ASR_API_URL,
    'API URL已配置',
    'API URL未配置（将使用默认值）',
    '在.env.local中添加: DOUBAO_ASR_API_URL=https://api.302.ai/doubao/largemodel/recognize'
  );

  // 2. 检查FFmpeg
  console.log('\n2️⃣ 检查系统依赖...');
  await check(
    'FFmpeg',
    async () => {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', (code: number) => resolve(code === 0));
      });
    },
    'FFmpeg已安装',
    'FFmpeg未安装',
    'Windows: choco install ffmpeg\nmacOS: brew install ffmpeg\nUbuntu: sudo apt-get install ffmpeg'
  );

  // 3. 检查Node.js版本
  await check(
    'Node.js版本',
    async () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      return major >= 18;
    },
    `Node.js ${process.version} ✅`,
    `Node.js ${process.version} 版本过低（需要 >= 18）`,
    '升级Node.js到v18或更高版本'
  );

  // 4. 检查必要的文件
  console.log('\n3️⃣ 检查项目文件...');
  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'lib/ai/doubao-asr.ts',
    'lib/video/video-processor.ts',
    'app/api/douyin/extract-text/route.ts',
    'hooks/use-douyin-extraction.ts',
    'components/douyin/douyin-extractor.tsx',
    'app/douyin-tool/page.tsx',
  ];

  for (const file of requiredFiles) {
    await check(
      path.basename(file),
      async () => fs.existsSync(path.join(process.cwd(), file)),
      '文件存在',
      '文件缺失',
      `缺少文件: ${file}`
    );
  }

  // 5. 检查package.json依赖
  console.log('\n4️⃣ 检查npm依赖...');
  const packageJson = require('../package.json');

  const requiredDeps = {
    'p-limit': 'v4+',
    'sonner': 'v1+',
  };

  for (const [dep, version] of Object.entries(requiredDeps)) {
    await check(
      dep,
      async () => !!packageJson.dependencies[dep] || !!packageJson.devDependencies[dep],
      `${dep} 已安装`,
      `${dep} 未安装`,
      `运行: pnpm add ${dep}`
    );
  }

  // 6. 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 检查结果汇总:\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warning').length;

  results.forEach((result) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.fix && result.status === 'fail') {
      console.log(`   💡 解决方案: ${result.fix}`);
    }
  });

  console.log(`\n📈 总计: ${passed} 通过, ${failed} 失败, ${warnings} 警告`);

  if (failed === 0) {
    console.log('\n🎉 恭喜！所有检查都通过了！\n');
    console.log('🚀 下一步操作:');
    console.log('   1. 运行测试: npx tsx scripts/test-doubao-asr.ts');
    console.log('   2. 启动服务: pnpm dev');
    console.log('   3. 访问页面: http://localhost:3007/douyin-tool\n');
    process.exit(0);
  } else {
    console.log('\n❌ 发现问题，请根据上述提示修复后重新运行检查。\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 检查过程出错:', error);
  process.exit(1);
});
