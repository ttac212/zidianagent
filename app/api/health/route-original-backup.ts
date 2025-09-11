/**
 * 连接监控健康检查API - 优化版本 v2.0
 * 特性：轻量级检查、功能开关支持、高性能、避免数据库连接池消耗
 * Phase 1: 基础设施搭建
 */

import { NextResponse } from 'next/server';

// 健康检查响应接口
interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'disabled';
  timestamp: string;
  uptime: number;
  responseTime: number;
  version: string;
  environment?: string;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  healthChecks?: string[];
  error?: string;
}

// 轻量级健康检查函数
async function performHealthChecks(): Promise<{ healthy: boolean; checks: string[] }> {
  const checks: string[] = [];
  let healthy = true;

  try {
    // 1. 基础进程检查
    const uptimeCheck = process.uptime() > 0;
    if (uptimeCheck) {
      checks.push('✓ Process uptime');
    } else {
      checks.push('✗ Process uptime');
      healthy = false;
    }

    // 2. 内存使用检查 (2GB阈值，适合Next.js开发环境)
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 2 * 1024 * 1024 * 1024; // 2GB
    const memoryHealthy = memoryUsage.heapUsed < memoryThreshold;
    
    if (memoryHealthy) {
      checks.push(`✓ Memory usage (${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB)`);
    } else {
      checks.push(`✗ Memory usage (${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB > 2048MB)`);
      healthy = false;
    }

    // 3. Node.js环境检查
    const nodeVersion = process.version;
    if (nodeVersion) {
      checks.push(`✓ Node.js ${nodeVersion}`);
    }

    // 4. 环境变量基础检查（避免数据库连接）
    const requiredEnvVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      checks.push('✓ Environment variables');
    } else {
      checks.push(`✗ Missing env vars: ${missingVars.join(', ')}`);
      healthy = false;
    }

  } catch (error) {
    void error
    checks.push(`✗ Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    healthy = false;
  }

  return { healthy, checks };
}

export async function GET() {
  const startTime = performance.now();

  try {
    // 检查功能开关
    const monitoringEnabled = process.env.NEXT_PUBLIC_CONNECTION_MONITORING;
    
    if (monitoringEnabled === 'disabled') {
      return NextResponse.json({
        status: 'disabled',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        responseTime: Math.round(performance.now() - startTime),
        version: process.env.npm_package_version || '1.0.0',
        message: 'Connection monitoring is disabled'
      } as HealthResponse, { status: 503 });
    }

    // 执行轻量级健康检查
    const { healthy, checks } = await performHealthChecks();
    const responseTime = Math.max(1, Math.round(performance.now() - startTime));

    // 构建响应数据
    const response: HealthResponse = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      responseTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
    };

    // 在调试模式下添加详细信息
    if (monitoringEnabled === 'debug') {
      const memoryUsage = process.memoryUsage();
      response.memoryUsage = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB  
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      };
      response.healthChecks = checks;
    }

    // 设置适当的HTTP状态码
    const statusCode = healthy ? 200 : 503;

    // 添加缓存控制头（防止缓存健康检查结果）
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    void error
    const responseTime = Math.max(1, Math.round(performance.now() - startTime));
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      responseTime,
      version: process.env.npm_package_version || '1.0.0',
      error: error instanceof Error ? error.message : 'Health check failed',
    } as HealthResponse, { status: 503 });
  }
}

export async function HEAD() {
  // 支持HEAD请求，用于更轻量的检查
  const monitoringEnabled = process.env.NEXT_PUBLIC_CONNECTION_MONITORING;
  
  if (monitoringEnabled === 'disabled') {
    return new NextResponse(null, { status: 503 });
  }

  try {
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    void error
    return new NextResponse(null, { status: 503 });
  }
}

// 只支持GET和HEAD方法，其他方法返回405
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'This endpoint only supports GET and HEAD methods' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'This endpoint only supports GET and HEAD methods' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'This endpoint only supports GET and HEAD methods' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}