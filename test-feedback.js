// 测试反馈功能的脚本
const testFeedbackAPI = async () => {
  const baseUrl = 'http://localhost:3007/api/feedback';
  
  // 1. 测试提交反馈（匿名）
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '测试反馈 - 匿名用户',
        content: '这是一个匿名用户提交的测试反馈，用于验证匿名反馈功能是否正常工作。',
        category: '功能建议',
        priority: 'medium',
        authorName: '测试用户张三',
        contactInfo: 'test@example.com'
      })
    });
    
    const result = await response.json();
    if (result.data) {
      }
  } catch (error) {
    }
  
  try {
    const response = await fetch(`${baseUrl}?page=1&limit=5`);
    const result = await response.json();
    
    if (result.success) {
      result.data.feedbacks.forEach((feedback, index) => {
        `);
      });
    } else {
      }
  } catch (error) {
    }
  
  try {
    const response = await fetch(`${baseUrl}?category=功能建议&status=pending`);
    const result = await response.json();
    
    if (result.success) {
      } else {
      }
  } catch (error) {
    }
};

// 执行测试
testFeedbackAPI().then(() => {
  }).catch(error => {
  });