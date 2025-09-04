/**
 * 最终验证脚本 - 测试商家和反馈功能
 */

const testAPIs = async () => {
  // 测试商家列表API
  try {
    const merchantsRes = await fetch('http://localhost:3007/api/merchants');
    const merchantsData = await merchantsRes.json();
    if (merchantsData.merchants.length > 0) {
      }
  } catch (error) {
    }
  
  // 测试商家统计API
  try {
    const statsRes = await fetch('http://localhost:3007/api/merchants/stats');
    const statsData = await statsRes.json();
    } catch (error) {
    }
  
  // 测试分类API
  try {
    const categoriesRes = await fetch('http://localhost:3007/api/merchants/categories');
    const categoriesData = await categoriesRes.json();
    if (categoriesData.length > 0) {
      `);
    }
  } catch (error) {
    }
  
  // 测试反馈API
  try {
    const feedbackRes = await fetch('http://localhost:3007/api/feedback');
    const feedbackData = await feedbackRes.json();
    if (feedbackData.success) {
      } else {
      }
  } catch (error) {
    }
  
  };

testAPIs();