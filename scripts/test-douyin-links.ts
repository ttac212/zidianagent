/**
 * 测试抖音链接检测功能
 */
import {
  detectDouyinLink,
  extractDouyinLink,
  extractDouyinLinkInfo,
  extractVideoId,
  extractAndResolveLink,
  isDouyinShareRequest,
} from '../lib/douyin/link-detector';

// 测试用例
const testCases = [
  {
    name: '短链接1 - 全屋定制口播视频',
    text: `3.53 Fhb:/ 01/07 G@V.yG 挑战30秒拍全屋定制口播视频 https://v.douyin.com/k5Nc3QsEQH8/ 复制此链接，打开Dou音搜索，直接观看视频！`,
  },
  {
    name: '短链接2 - 全屋定制都是坑',
    text: `1.20 u@F.uF LWM:/ 03/15 全屋定制都是坑.在等着你跳.规避下来能省大几万 https://v.douyin.com/JlE0ONjNj1s/ 复制此链接`,
  },
  {
    name: '视频完整链接',
    text: 'https://www.douyin.com/video/7445678901234567890',
  },
  {
    name: '图文完整链接',
    text: 'https://www.douyin.com/note/7445678901234567890',
  },
  {
    name: '图集完整链接',
    text: 'https://www.douyin.com/slides/7445678901234567890',
  },
  {
    name: '用户主页链接',
    text: 'https://www.douyin.com/user/MS4wLjABAAAAxxx',
  },
  {
    name: '用户主页+作品链接',
    text: 'https://www.douyin.com/user/MS4wLjABAAAAxxx?modal_id=7445678901234567890',
  },
  {
    name: '分享链接',
    text: 'https://www.iesdouyin.com/share/video/7445678901234567890/',
  },
  {
    name: '搜索结果链接',
    text: 'https://www.douyin.com/search/全屋定制?modal_id=7445678901234567890',
  },
];

console.log('🔍 开始测试抖音链接检测功能\n');
console.log('='.repeat(80));

async function runTests() {
  for (const testCase of testCases) {
    console.log(`\n📌 测试用例: ${testCase.name}`);
    console.log('-'.repeat(80));

    // 测试1: 检测是否包含抖音链接
    const hasLink = detectDouyinLink(testCase.text);
    console.log(`✓ detectDouyinLink(): ${hasLink ? '✅ 检测到链接' : '❌ 未检测到链接'}`);

    // 测试2: 提取链接
    const extractedLink = extractDouyinLink(testCase.text);
    if (extractedLink) {
      console.log(`✓ extractDouyinLink(): ✅ ${extractedLink}`);
    } else {
      console.log(`✓ extractDouyinLink(): ❌ 未能提取链接`);
    }

    // 测试3: 提取链接详细信息
    const linkInfo = extractDouyinLinkInfo(testCase.text);
    if (linkInfo) {
      console.log(`✓ extractDouyinLinkInfo():`);
      console.log(`   - 类型: ${linkInfo.type}`);
      console.log(`   - ID: ${linkInfo.id || '无'}`);
      console.log(`   - 需要重定向: ${linkInfo.needsRedirect ? '是' : '否'}`);
    }

    // 测试4: 提取作品ID
    if (extractedLink) {
      const videoId = extractVideoId(extractedLink);
      if (videoId) {
        console.log(`✓ extractVideoId(): ✅ ${videoId}`);
      } else {
        console.log(`✓ extractVideoId(): ⚠️  无作品ID (可能是用户主页)`);
      }
    }

    // 测试5: 判断是否为分享请求
    const isShareRequest = isDouyinShareRequest(testCase.text);
    console.log(
      `✓ isDouyinShareRequest(): ${isShareRequest ? '✅ 是分享请求' : '⚠️  不是分享请求'}`
    );

    // 测试6: 短链接重定向 (仅对短链接测试)
    if (linkInfo?.needsRedirect && linkInfo.type === 'short_link') {
      console.log(`\n🔄 测试短链接重定向...`);
      try {
        const resolvedInfo = await extractAndResolveLink(testCase.text);
        if (resolvedInfo && resolvedInfo.id) {
          console.log(`✓ extractAndResolveLink(): ✅ 重定向成功`);
          console.log(`   - 重定向后类型: ${resolvedInfo.type}`);
          console.log(`   - 重定向后ID: ${resolvedInfo.id}`);
        } else {
          console.log(`✓ extractAndResolveLink(): ⚠️  重定向失败或无法提取ID`);
        }
      } catch (error) {
        console.log(`✓ extractAndResolveLink(): ❌ 错误: ${error}`);
      }
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n✅ 测试完成！');
}

runTests().catch(console.error);
