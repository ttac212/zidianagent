/**
 * 响应式连接状态指示组件
 * 用于在主界面显示连接监控状态的轻量级指示器
 * Phase 1: 基础设施搭建
 */

'use client';

import { useConnectionMonitor } from '@/hooks/use-connection-monitor';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Wifi, 
  WifiOff, 
  Server, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Loader2
} from 'lucide-react';

// 动画样式类
const getAnimationClasses = (status: string, animated: boolean) => {
  if (!animated) return '';
  
  const classes = [];
  
  if (status !== 'healthy') {
    classes.push('connection-pulse');
  }
  
  return classes.join(' ');
};

export interface ConnectionStatusProps {
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 组件大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 显示位置 */
  position?: 'fixed' | 'relative';
  /** 是否显示文本标签 */
  showLabel?: boolean;
  /** 自定义CSS类名 */
  className?: string;
  /** 状态变化回调 */
  onStatusChange?: (connected: boolean) => void;
  /** 是否启用动画效果 */
  animated?: boolean;
  /** 是否自动隐藏良好状态 */
  autoHideWhenHealthy?: boolean;
  /** Tooltip延迟显示时间(ms) */
  tooltipDelay?: number;
}

export function ConnectionStatus({
  showDetails = false,
  size = 'md',
  position = 'relative',
  showLabel = true,
  className,
  onStatusChange,
  animated = true,
  autoHideWhenHealthy = false,
  tooltipDelay = 500
}: ConnectionStatusProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string>('unknown');
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const [isMounted, setIsMounted] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  
  const {
    isConnected,
    isOnline,
    isServerHealthy,
    responseTime,
    consecutiveFailures,
    currentInterval,
    error,
    triggerHealthCheck,
    debugInfo
  } = useConnectionMonitor({
    onStatusChange: (state) => {
      const currentStatus = state.isOnline && state.isServerHealthy ? 'healthy' : 'unhealthy';
      if (currentStatus !== previousStatus && animated) {
        setPreviousStatus(currentStatus);
      }
      onStatusChange?.(state.isOnline && state.isServerHealthy);
    }
  });

  // 客户端挂载标记
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 状态变化动画效果
  useEffect(() => {
    if (componentRef.current && animated && isMounted) {
      const element = componentRef.current;
      element.style.transform = 'scale(1.05)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 150);
    }
  }, [isConnected, animated, isMounted]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // 获取状态配置 - 服务端渲染时始终返回默认状态
  const getStatusConfig = () => {
    // 服务端渲染或未挂载时，返回默认的健康状态
    if (!isMounted) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        borderColor: 'border-green-200 dark:border-green-800',
        label: '正常',
        status: 'healthy' as const,
        pulseColor: 'shadow-green-400/50',
        ariaLabel: '连接状态检查中'
      };
    }

    // 客户端已挂载，使用真实状态
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        borderColor: 'border-red-200 dark:border-red-800',
        label: '离线',
        status: 'offline' as const,
        pulseColor: 'shadow-red-400/50',
        ariaLabel: '网络连接离线，无法访问服务'
      };
    }

    if (!isServerHealthy) {
      return {
        icon: Server,
        color: 'text-yellow-500', 
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        label: '服务异常',
        status: 'error' as const,
        pulseColor: 'shadow-yellow-400/50',
        ariaLabel: '服务器连接异常，可能正在维护'
      };
    }

    if (consecutiveFailures > 0) {
      return {
        icon: AlertTriangle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20', 
        borderColor: 'border-orange-200 dark:border-orange-800',
        label: '不稳定',
        status: 'warning' as const,
        pulseColor: 'shadow-orange-400/50',
        ariaLabel: `连接不稳定，已连续失败${consecutiveFailures}次`
      };
    }

    return {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800', 
      label: '正常',
      status: 'healthy' as const,
      pulseColor: 'shadow-green-400/50',
      ariaLabel: `连接正常，响应时间${responseTime || 0}毫秒`
    };
  };

  // 获取尺寸配置
  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'h-6 gap-1.5',
          icon: 'w-3 h-3',
          text: 'text-xs',
          button: 'h-6 w-6 p-1'
        };
      case 'lg':
        return {
          container: 'h-10 gap-2.5',
          icon: 'w-5 h-5', 
          text: 'text-sm',
          button: 'h-8 w-8 p-1.5'
        };
      default: // md
        return {
          container: 'h-8 gap-2',
          icon: 'w-4 h-4',
          text: 'text-sm',
          button: 'h-7 w-7 p-1'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const sizeConfig = getSizeConfig();
  const Icon = statusConfig.icon;

  // 智能检测tooltip位置，避免与Header重叠
  const detectTooltipPosition = () => {
    if (!componentRef.current) return 'top';
    
    const rect = componentRef.current.getBoundingClientRect();
    const headerHeight = 64; // Header组件高度16 (4rem)
    const tooltipHeight = 80; // 估计tooltip高度
    
    // 如果组件距离顶部太近（可能与Header重叠），显示在下方
    if (rect.top - tooltipHeight < headerHeight + 8) {
      return 'bottom';
    }
    
    return 'top';
  };

  // 处理Tooltip显示逻辑
  const handleTooltipShow = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipPosition(detectTooltipPosition());
      setShowTooltip(true);
    }, tooltipDelay);
  };

  const handleTooltipHide = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltip(false);
  };

  // 手动刷新处理
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerHealthCheck();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // 生成tooltip内容
  const getTooltipContent = () => {
    const parts = [];
    
    parts.push(`状态: ${statusConfig.label}`);
    
    if (responseTime) {
      const quality = responseTime < 200 ? '优秀' : responseTime < 500 ? '良好' : responseTime < 1000 ? '一般' : '较慢';
      parts.push(`响应时间: ${responseTime}ms (${quality})`);
    }
    
    if (consecutiveFailures > 0) {
      parts.push(`连续失败: ${consecutiveFailures}次`);
    }
    
    parts.push(`检查间隔: ${currentInterval/1000}s`);
    
    if (debugInfo.successRate > 0) {
      parts.push(`成功率: ${Math.round(debugInfo.successRate)}%`);
    }
    
    if (error) {
      parts.push(`错误: ${error}`);
    }
    
    return parts.join('\n');
  };

  // 根据设置决定是否显示组件
  const shouldHide = autoHideWhenHealthy && statusConfig.status === 'healthy' && consecutiveFailures === 0;
  
  const baseClasses = cn(
    'inline-flex items-center px-3 py-1 rounded-full border connection-responsive',
    'transform hover:scale-105 focus-within:scale-105',
    'hover:shadow-md focus-within:shadow-md',
    statusConfig.bgColor,
    statusConfig.borderColor,
    sizeConfig.container,
    position === 'fixed' && 'fixed top-4 right-4 z-[45] shadow-lg',
    getAnimationClasses(statusConfig.status, animated),
    shouldHide && 'opacity-30 hover:opacity-100 transition-opacity',
    className
  );

  return (
    <div 
      ref={componentRef}
      className={baseClasses}
      onMouseEnter={handleTooltipShow}
      onMouseLeave={handleTooltipHide}
      onFocus={handleTooltipShow}
      onBlur={handleTooltipHide}
      role="status"
      aria-live="polite"
      aria-label={statusConfig.ariaLabel}
      tabIndex={0}
    >
      {/* 状态图标 */}
      <Icon 
        className={cn(
          sizeConfig.icon, 
          statusConfig.color,
          animated && isMounted && statusConfig.status !== 'healthy' && 'animate-pulse'
        )} 
        aria-hidden="true"
      />
      
      {/* 状态文本 */}
      {showLabel && (
        <span className={cn(sizeConfig.text, statusConfig.color, 'font-medium')}>
          {statusConfig.label}
        </span>
      )}

      {/* 响应时间 */}
      {showDetails && responseTime && (
        <span className={cn(sizeConfig.text, 'text-gray-500 font-mono')}>
          {responseTime}ms
        </span>
      )}

      {/* 手动刷新按钮 */}
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className={cn(
          'rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeConfig.button
        )}
        title="手动检查连接"
        aria-label="手动检查网络连接状态"
      >
        {isRefreshing ? (
          <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className={cn(
          "absolute left-1/2 transform -translate-x-1/2 z-[60] connection-fade-in",
          tooltipPosition === 'top' ? "bottom-full mb-2" : "top-full mt-2"
        )}>
          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-4 py-3 whitespace-pre-line max-w-sm md:max-w-2xl shadow-lg border border-gray-700">
            {getTooltipContent()}
            {/* 箭头指向 */}
            <div className={cn(
              "absolute left-1/2 transform -translate-x-1/2 border-4 border-transparent",
              tooltipPosition === 'top' 
                ? "top-full border-t-gray-900 dark:border-t-gray-800"
                : "bottom-full border-b-gray-900 dark:border-b-gray-800"
            )}></div>
          </div>
        </div>
      )}

      {/* 详细状态面板 */}
      {showDetails && (
        <div className="ml-2 flex items-center gap-1.5 text-xs text-gray-500">
          {/* 检查间隔指示器 */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{currentInterval/1000}s</span>
          </div>

          {/* 失败次数 */}
          {consecutiveFailures > 0 && (
            <div className="text-red-500 font-medium">
              ×{consecutiveFailures}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 预设的状态指示器变体
 */
export const ConnectionStatusVariants = {
  // 顶部固定状态栏
  TopBar: (props: Omit<ConnectionStatusProps, 'position' | 'size'>) => (
    <ConnectionStatus {...props} position="fixed" size="sm" />
  ),

  // 侧边栏状态
  Sidebar: (props: Omit<ConnectionStatusProps, 'showDetails' | 'size'>) => (
    <ConnectionStatus {...props} showDetails={true} size="md" />
  ),

  // 紧凑状态指示器（仅图标）
  Compact: (props: Omit<ConnectionStatusProps, 'showLabel' | 'size'>) => (
    <ConnectionStatus {...props} showLabel={false} size="sm" />
  ),

  // 详细状态面板
  Detailed: (props: Omit<ConnectionStatusProps, 'showDetails' | 'size'>) => (
    <ConnectionStatus {...props} showDetails={true} size="lg" />
  )
};