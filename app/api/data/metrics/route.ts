import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

// 统一的度量存储（实际项目应使用数据库）
const metricsStore = {
  events: [] as any[],
  metrics: [] as any[],
  maxEvents: 10000,
  maxMetrics: 50000
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { type, ...data } = body;

    // 根据类型处理不同的度量
    switch (type) {
      case 'event':
        return handleEvent(data, request);
      case 'metric':
      case 'performance':
        return handleMetric(data);
      case 'usage':
        return handleUsage(data, session?.user?.id);
      default:
        // 兼容旧API：如果没有type，尝试自动识别
        if (data.eventType || data.eventName) {
          return handleEvent(data, request);
        }
        if (data.metricType || data.value !== undefined) {
          return handleMetric(data);
        }
        // 默认作为日志处理
        return NextResponse.json({ ok: true, success: true });
    }
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '处理度量失败' 
    }, { status: 500 });
  }
}

function handleEvent(data: any, request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';

  const enrichedEvent = {
    ...data,
    ip,
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: data.timestamp || new Date().toISOString(),
    type: 'event'
  };

  metricsStore.events.push(enrichedEvent);

  // 限制存储大小
  if (metricsStore.events.length > metricsStore.maxEvents) {
    metricsStore.events.splice(0, metricsStore.events.length - metricsStore.maxEvents);
  }

  return NextResponse.json({ 
    success: true, 
    eventId: enrichedEvent.id,
    ok: true // 兼容旧API
  });
}

function handleMetric(data: any) {
  const enrichedMetric = {
    ...data,
    id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: data.timestamp || new Date().toISOString(),
    type: 'metric'
  };

  metricsStore.metrics.push(enrichedMetric);

  // 限制存储大小
  if (metricsStore.metrics.length > metricsStore.maxMetrics) {
    metricsStore.metrics.splice(0, metricsStore.metrics.length - metricsStore.maxMetrics);
  }

  return NextResponse.json({ 
    success: true, 
    metricId: enrichedMetric.id,
    ok: true // 兼容旧API
  });
}

async function handleUsage(data: any, userId?: string) {
  // 使用量统计逻辑（后续可接入数据库）
  const usageRecord = {
    ...data,
    userId,
    id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type: 'usage'
  };

  // 这里可以保存到数据库
  // await prisma.dailyUsage.upsert(...)

  return NextResponse.json({ 
    success: true, 
    usageId: usageRecord.id,
    ok: true
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type') || searchParams.get('dataType');
    const metricType = searchParams.get('metricType');
    const eventType = searchParams.get('eventType');
    const timeRange = searchParams.get('timeRange') || '24h';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 计算时间范围
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    let result: any = {
      success: true,
      ok: true,
      data: {}
    };

    // 根据请求类型返回不同数据
    if (dataType === 'event' || eventType) {
      let filteredEvents = metricsStore.events.filter(
        event => new Date(event.timestamp) >= startTime
      );
      
      if (eventType) {
        filteredEvents = filteredEvents.filter(e => e.eventType === eventType);
      }

      const paginatedEvents = filteredEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);

      result.data = {
        events: paginatedEvents,
        total: filteredEvents.length,
        hasMore: offset + limit < filteredEvents.length
      };
    } else if (dataType === 'metric' || metricType) {
      let filteredMetrics = metricsStore.metrics.filter(
        metric => new Date(metric.timestamp) >= startTime
      );
      
      if (metricType) {
        filteredMetrics = filteredMetrics.filter(m => m.metricType === metricType);
      }

      // 计算统计信息
      const values = filteredMetrics.map(m => m.value || 0);
      const stats = {
        count: values.length,
        avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0
      };

      result.data = {
        metrics: filteredMetrics.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
        stats,
        timeRange
      };
    } else {
      // 返回所有数据的摘要
      result.data = {
        summary: {
          totalEvents: metricsStore.events.length,
          totalMetrics: metricsStore.metrics.length,
          timeRange
        }
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      ok: false,
      error: error instanceof Error ? error.message : '获取数据失败' 
    }, { status: 500 });
  }
}