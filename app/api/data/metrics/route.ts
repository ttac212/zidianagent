import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import {
  forbidden,
  unauthorized,
  serverError
} from '@/lib/api/http-response'

// SECURITY: Metrics API完全重写 - 使用数据库存储
export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return unauthorized('Authentication required for metrics API');
    }

    if (session.user.role !== 'ADMIN') {
      return forbidden('Admin role required for metrics API');
    }

    // 2. 速率限制
    const rateLimitResult = await checkRateLimit(request, 'ADMIN', session.user.id);
    if (!rateLimitResult.allowed) {
      return forbidden(`Rate limited: ${rateLimitResult.error?.message}`);
    }

    // 3. TODO: 实现数据库存储
    // const body = await request.json();
    // await prisma.systemMetrics.create({
    //   data: {
    //     userId: session.user.id,
    //     type: body.type,
    //     data: body,
    //     createdAt: new Date()
    //   }
    // });

    return forbidden('Metrics collection disabled. Use structured logging instead.');

  } catch (_error) {
    return serverError('Metrics API error');
  }
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return forbidden('Admin access required for metrics data');
  }

  // TODO: 实现从数据库读取metrics
  return forbidden('Metrics reading disabled. Use system logs instead.');
}