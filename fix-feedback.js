const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFeedback() {
  try {
    const feedbacks = await prisma.feedback.findMany();
    if (feedbacks.length > 0) {
      // 删除乱码数据
      await prisma.feedback.deleteMany({
        where: {
          OR: [
            { title: { contains: '���' } },
            { content: { contains: '���' } },
            { authorName: { contains: '���' } }
          ]
        }
      });
      }
    
    // 创建正确的测试数据
    const testFeedbacks = [
      {
        title: '建议增加深色模式',
        content: '希望系统能够支持深色模式，这样在夜间使用会更加舒适，保护眼睛。很多现代应用都已经支持了这个功能。',
        type: 'FEATURE_REQUEST',
        priority: 'MEDIUM',
        status: 'OPEN',
        authorName: '张先生',
        contactInfo: 'zhang@example.com'
      },
      {
        title: '商家数据加载缓慢',
        content: '在查看商家列表时，数据加载速度较慢，特别是在数据量大的时候。建议优化查询性能或添加分页加载。',
        type: 'BUG_REPORT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        authorName: '李女士',
        contactInfo: '13800138000',
        response: '感谢您的反馈，我们正在优化数据库查询性能，预计下周更新。'
      },
      {
        title: '界面设计非常美观',
        content: '新的界面设计非常现代化，用户体验很好。特别是商家数据展示页面，信息层次清晰，一目了然。',
        type: 'COMPLIMENT',
        priority: 'LOW',
        status: 'RESOLVED',
        authorName: '王经理',
        contactInfo: 'wang@company.com',
        response: '非常感谢您的认可！我们会继续努力提供更好的用户体验。'
      },
      {
        title: '希望增加数据导出功能',
        content: '目前系统可以查看商家数据，但无法导出为Excel或CSV格式。希望能增加数据导出功能，方便进行数据分析。',
        type: 'FEATURE_REQUEST',
        priority: 'MEDIUM',
        status: 'OPEN',
        authorName: '赵总',
        contactInfo: 'zhao@business.com'
      },
      {
        title: '移动端适配问题',
        content: '在手机浏览器上访问时，部分页面布局有错位现象，按钮太小不便点击。建议优化移动端的响应式设计。',
        type: 'IMPROVEMENT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        authorName: '刘小姐',
        contactInfo: '15900159000'
      }
    ];
    
    for (const feedback of testFeedbacks) {
      const created = await prisma.feedback.create({
        data: feedback
      });
      }
    
    // 验证数据
    const allFeedbacks = await prisma.feedback.findMany();
    const openCount = await prisma.feedback.count({
      where: { status: 'OPEN' }
    });
    const inProgressCount = await prisma.feedback.count({
      where: { status: 'IN_PROGRESS' }
    });
    const resolvedCount = await prisma.feedback.count({
      where: { status: 'RESOLVED' }
    });
    
    } catch (error) {
    } finally {
    await prisma.$disconnect();
  }
}

fixFeedback();