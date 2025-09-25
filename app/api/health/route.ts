/**
 * 增强版健康检查API - 带详细诊断信息
 * 解决503间歇性错误问题
 */

import { NextResponse } from 'next/server';

// 请求计数器和统计
let requestCounter = 0;
let successCount = 0;
let failureCount = 0;
const recentRequests: Array<{
  id: number;
  timestamp: string;
  status: number;
  reason?: string;
  duration: number;
}> = [];

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
  diagnostics?: {
    requestId: number;
    configStatus: string;
    recentHistory?: typeof recentRequests;
    statistics?: {
      total: number;
      success: number;
      failure: number;
      successRate: number;
    };
  };
}

// 增强的健康检查函数
async function performHealthChecks(): Promise<{ 
  healthy: boolean; 
  checks: string[]; 
  failureReasons: string[] 
}> {
  const checks: string[] = [];
  const failureReasons: string[] = [];
  let healthy = true;

  try {
    // 1. 配置检查
    const monitoringConfig = process.env.NEXT_PUBLIC_CONNECTION_MONITORING;
    checks.push(`✓ Config: CONNECTION_MONITORING=${monitoringConfig || 'undefined'}`);
    
    if (monitoringConfig === 'disabled') {
      failureReasons.push('Connection monitoring is disabled in config');
      healthy = false;
      checks.push('✗ Monitoring disabled by configuration');
    }

    // 2. 进程检查
    const uptimeCheck = process.uptime() > 0;
    if (uptimeCheck) {
      checks.push(`✓ Process uptime: ${Math.floor(process.uptime())}s`);
    } else {
      checks.push('✗ Process uptime check failed');
      failureReasons.push('Process uptime check failed');
      healthy = false;
    }

    // 3. 内存使用检查（动态阈值）
    const memoryUsage = process.memoryUsage();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const memoryThreshold = isDevelopment ? 
      4 * 1024 * 1024 * 1024 : // 4GB for development
      2 * 1024 * 1024 * 1024;   // 2GB for production
    
    const memoryHealthy = memoryUsage.heapUsed < memoryThreshold;
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const thresholdMB = Math.round(memoryThreshold / 1024 / 1024);
    
    if (memoryHealthy) {
      checks.push(`✓ Memory: ${memoryMB}MB / ${thresholdMB}MB`);
    } else {
      checks.push(`✗ Memory: ${memoryMB}MB > ${thresholdMB}MB threshold`);
      failureReasons.push(`Memory usage exceeds threshold: ${memoryMB}MB > ${thresholdMB}MB`);
      healthy = false;
    }

    // 4. Node.js版本检查
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
      checks.push(`✓ Node.js ${nodeVersion}`);
    } else {
      checks.push(`⚠ Node.js ${nodeVersion} (recommend v18+)`);
    }

    // 5. 必需环境变量检查
    const requiredEnvVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      checks.push('✓ Required environment variables present');
    } else {
      checks.push(`✗ Missing env vars: ${missingVars.join(', ')}`);
      failureReasons.push(`Missing required environment variables: ${missingVars.join(', ')}`);
      healthy = false;
    }

    // 6. 数据库URL检查（不实际连接）
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      checks.push('✓ Database URL configured');
    } else {
      checks.push('⚠ Database URL not configured');
    }

    // 7. API Key配置检查
    const { getKeyHealthStatus } = await import('@/lib/ai/key-manager');
    const keyStatus = getKeyHealthStatus();
    if (keyStatus.hasKey) {
      const keyList = [];
      if (keyStatus.keys.claude) keyList.push('Claude');
      if (keyStatus.keys.gemini) keyList.push('Gemini');
      if (keyStatus.keys.openai) keyList.push('OpenAI');
      if (keyStatus.keys.fallback) keyList.push('Fallback');
      checks.push(`✓ API Keys configured: ${keyList.join(', ')}`);
    } else {
      checks.push('⚠ No API keys configured');
    }

    // 7. 运行模式检查
    const runMode = process.env.NODE_ENV || 'development';
    checks.push(`ℹ Running in ${runMode} mode`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    checks.push(`✗ Health check error: ${errorMsg}`);
    failureReasons.push(`Health check error: ${errorMsg}`);
    healthy = false;
  }

  return { healthy, checks, failureReasons };
}

export async function GET() {
  const startTime = performance.now();
  const requestId = ++requestCounter;

  try {
    // 检查功能开关（早期检查）
    const monitoringEnabled = process.env.NEXT_PUBLIC_CONNECTION_MONITORING;
    
    // 如果明确设置为 disabled，返回503但包含诊断信息
    if (monitoringEnabled === 'disabled') {
      const responseTime = Math.round(performance.now() - startTime);
      
      // 记录请求
      recentRequests.push({
        id: requestId,
        timestamp: new Date().toISOString(),
        status: 503,
        reason: 'Monitoring disabled',
        duration: responseTime
      });
      
      // 保持最近10条记录
      if (recentRequests.length > 10) {
        recentRequests.shift();
      }
      
      failureCount++;
      
      return NextResponse.json({
        status: 'disabled',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        responseTime,
        version: process.env.npm_package_version || '1.0.0',
        message: 'Connection monitoring is disabled',
        diagnostics: {
          requestId,
          configStatus: `NEXT_PUBLIC_CONNECTION_MONITORING=${monitoringEnabled}`,
          statistics: {
            total: requestCounter,
            success: successCount,
            failure: failureCount,
            successRate: requestCounter > 0 ? (successCount / requestCounter * 100) : 0
          }
        }
      } as HealthResponse, { 
        status: 503,
        headers: {
          'X-Request-Id': requestId.toString(),
          'X-Health-Status': 'disabled',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }

    // 执行健康检查
    const { healthy, checks, failureReasons } = await performHealthChecks();
    const responseTime = Math.round(performance.now() - startTime);

    // 记录请求
    recentRequests.push({
      id: requestId,
      timestamp: new Date().toISOString(),
      status: healthy ? 200 : 503,
      reason: failureReasons.length > 0 ? failureReasons[0] : undefined,
      duration: responseTime
    });
    
    // 保持最近10条记录
    if (recentRequests.length > 10) {
      recentRequests.shift();
    }

    // 更新统计
    if (healthy) {
      successCount++;
    } else {
      failureCount++;
    }

    // 构建响应
    const response: HealthResponse = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      responseTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
    };

    // 添加详细信息（开发环境或调试模式）
    const isDebugMode = monitoringEnabled === 'debug' || 
                       process.env.NODE_ENV === 'development';
    
    if (isDebugMode) {
      const memoryUsage = process.memoryUsage();
      response.memoryUsage = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      };
      response.healthChecks = checks;
      
      // 添加诊断信息
      response.diagnostics = {
        requestId,
        configStatus: `NEXT_PUBLIC_CONNECTION_MONITORING=${monitoringEnabled}`,
        recentHistory: recentRequests.slice(-5), // 最近5条请求
        statistics: {
          total: requestCounter,
          success: successCount,
          failure: failureCount,
          successRate: requestCounter > 0 ? 
            Math.round(successCount / requestCounter * 100 * 100) / 100 : 0
        }
      };
    }

    // 如果不健康，添加错误信息
    if (!healthy && failureReasons.length > 0) {
      response.error = failureReasons.join('; ');
    }

    const statusCode = healthy ? 200 : 503;

    // 返回响应
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'X-Request-Id': requestId.toString(),
        'X-Health-Status': healthy ? 'healthy' : 'unhealthy',
        'X-Success-Rate': `${Math.round(successCount / requestCounter * 100)}%`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    
    // 记录错误
    failureCount++;
    recentRequests.push({
      id: requestId,
      timestamp: new Date().toISOString(),
      status: 503,
      reason: error instanceof Error ? error.message : 'Unknown error',
      duration: responseTime
    });
    
    if (recentRequests.length > 10) {
      recentRequests.shift();
    }
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      responseTime,
      version: process.env.npm_package_version || '1.0.0',
      error: error instanceof Error ? error.message : 'Health check failed',
      diagnostics: {
        requestId,
        configStatus: 'Error during health check',
        statistics: {
          total: requestCounter,
          success: successCount,
          failure: failureCount,
          successRate: requestCounter > 0 ? 
            Math.round(successCount / requestCounter * 100 * 100) / 100 : 0
        }
      }
    } as HealthResponse, { 
      status: 503,
      headers: {
        'X-Request-Id': requestId.toString(),
        'X-Health-Status': 'error',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}

// HEAD请求支持
export async function HEAD() {
  const monitoringEnabled = process.env.NEXT_PUBLIC_CONNECTION_MONITORING;
  
  if (monitoringEnabled === 'disabled') {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'X-Health-Status': 'disabled',
      }
    });
  }

  // 简化的健康检查
  const { healthy } = await performHealthChecks();
  
  return new NextResponse(null, { 
    status: healthy ? 200 : 503,
    headers: {
      'X-Health-Status': healthy ? 'healthy' : 'unhealthy',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
}

// 其他HTTP方法
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}