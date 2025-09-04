/**
 * 连接监控Hook测试组件
 * 用于验证Hook功能是否正常
 */

'use client';

import { useConnectionMonitor } from '@/hooks/use-connection-monitor';
import { useState } from 'react';

export default function ConnectionMonitorTest() {
  const [showDebug, setShowDebug] = useState(false);
  
  const {
    isConnected,
    isOnline,
    isServerHealthy,
    lastCheck,
    consecutiveFailures,
    currentInterval,
    error,
    responseTime,
    serverStatus,
    triggerHealthCheck,
    debugInfo,
    stats
  } = useConnectionMonitor({
    onStatusChange: (state) => {
      },
    onError: (error) => {
      },
    onRecover: () => {
      }
  });

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (!isServerHealthy) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '🔴';
    if (!isServerHealthy) return '🟡';
    return '🟢';
  };

  const formatInterval = (ms: number) => {
    return ms >= 1000 ? `${ms/1000}s` : `${ms}ms`;
  };

  return (
    <div className="fixed top-4 right-4 bg-white border rounded-lg shadow-lg p-4 w-80 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">连接监控测试</h3>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs px-2 py-1 bg-gray-100 rounded"
        >
          {showDebug ? '隐藏' : '调试'}
        </button>
      </div>

      {/* 主要状态 */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>总体状态:</span>
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusIcon()} {isConnected ? '已连接' : '连接异常'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>网络状态:</span>
          <span className={isOnline ? 'text-green-500' : 'text-red-500'}>
            {isOnline ? '在线' : '离线'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>服务器状态:</span>
          <span className={isServerHealthy ? 'text-green-500' : 'text-red-500'}>
            {isServerHealthy ? '正常' : '异常'} 
            {serverStatus && `(${serverStatus})`}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>检查间隔:</span>
          <span className="font-mono text-blue-600">
            {formatInterval(currentInterval)}
          </span>
        </div>

        {responseTime && (
          <div className="flex items-center justify-between">
            <span>响应时间:</span>
            <span className="font-mono text-blue-600">{responseTime}ms</span>
          </div>
        )}

        {consecutiveFailures > 0 && (
          <div className="flex items-center justify-between">
            <span>连续失败:</span>
            <span className="font-mono text-red-600">{consecutiveFailures}次</span>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-xs mt-2 p-2 bg-red-50 rounded">
            错误: {error}
          </div>
        )}
      </div>

      {/* 调试信息 */}
      {showDebug && (
        <div className="mt-4 pt-3 border-t space-y-2 text-xs">
          <div className="font-semibold text-gray-700">调试信息:</div>
          
          <div className="space-y-1">
            <div>模式: <span className="font-mono">{debugInfo.adaptiveMode}</span></div>
            <div>最后检查: <span className="font-mono">{debugInfo.lastCheckTime}</span></div>
            <div>总检查数: <span className="font-mono">{debugInfo.totalChecks}</span></div>
            <div>成功率: <span className="font-mono">{debugInfo.successRate.toFixed(1)}%</span></div>
            <div>启用状态: <span className="font-mono">{debugInfo.enabled ? '是' : '否'}</span></div>
          </div>

          <div className="mt-2 pt-2 border-t">
            <div className="font-semibold text-gray-700">统计信息:</div>
            <div>成功: {stats.successfulChecks}/{stats.totalChecks}</div>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="mt-3 pt-3 border-t">
        <button
          onClick={triggerHealthCheck}
          className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          手动检查
        </button>
      </div>
    </div>
  );
}