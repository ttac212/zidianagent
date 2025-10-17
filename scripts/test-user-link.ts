/**
 * 测试用户提供的真实链接
 */
import { parseDouyinVideoShare } from '../lib/douyin/share-link';
import { extractAndResolveLink } from '../lib/douyin/link-detector';

const userText = `广州缝制设备、刺绣设备、数码印花、面辅料展会，11月3-5日广州空港博览中心,VIP门票免费领取中 https://v.douyin.com/6l4Y_99aK2M/ 复制此链接，打开【抖音】，直接观看视频！`;

async function testUserLink() {
  console.log('🔍 测试用户提供的真实抖音链接\n');
  console.log('='.repeat(80));
  console.log('文本内容:');
  console.log(userText);
  console.log('='.repeat(80));

  // 测试1: 使用旧的 parseDouyinVideoShare
  console.log('\n📌 测试1: parseDouyinVideoShare()');
  console.log('-'.repeat(80));
  try {
    const result = await parseDouyinVideoShare(userText);
    console.log('✅ 解析成功:');
    console.log('   - 原始URL:', result.originalUrl);
    console.log('   - 重定向URL:', result.resolvedUrl);
    console.log('   - 视频ID:', result.videoId || '❌ 未提取到');
    console.log('   - 用户ID:', result.userId || '无');
  } catch (error) {
    console.log('❌ 解析失败:', error instanceof Error ? error.message : error);
  }

  // 测试2: 使用新的 extractAndResolveLink
  console.log('\n📌 测试2: extractAndResolveLink()');
  console.log('-'.repeat(80));
  try {
    const result = await extractAndResolveLink(userText);
    if (result) {
      console.log('✅ 解析成功:');
      console.log('   - 原始URL:', result.url);
      console.log('   - 链接类型:', result.type);
      console.log('   - ID:', result.id || '❌ 未提取到');
      console.log('   - 需要重定向:', result.needsRedirect ? '是' : '否');
    } else {
      console.log('❌ 未找到链接');
    }
  } catch (error) {
    console.log('❌ 解析失败:', error instanceof Error ? error.message : error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
}

testUserLink().catch(console.error);
