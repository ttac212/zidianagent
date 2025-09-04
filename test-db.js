const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('正在测试数据库连接...');

    // 测试数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功！');

    // 生成唯一的测试邮箱
    const testEmail = `test-${Date.now()}@example.com`;

    // 先清理可能存在的测试数据
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test@example.com'
        }
      },
    });

    // 测试创建一个用户
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        displayName: 'Test User',
      },
    });
    console.log('✅ 用户创建成功:', user);

    // 查询所有用户
    const users = await prisma.user.findMany();
    console.log('✅ 查询用户成功，总数:', users.length);

    // 清理测试数据
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
    console.log('✅ 测试数据清理完成');

  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
  } finally {
    await prisma.$disconnect();
    console.log('数据库连接已断开');
  }
}

testDatabase();