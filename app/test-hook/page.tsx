/**
 * Hook测试页面
 * 用于验证连接监控Hook是否正常工作
 */

import ConnectionMonitorTest from '@/components/test/connection-monitor-test';

export default function TestHookPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">连接监控Hook测试</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">测试说明</h2>
          <ul className="space-y-2 text-gray-700">
            <li>• 查看右上角的连接监控状态面板</li>
            <li>• 观察自适应检查间隔的变化</li>
            <li>• 点击"手动检查"按钮测试即时检查</li>
            <li>• 点击"调试"查看详细信息</li>
            <li>• 可以尝试断网来测试网络状态检测</li>
          </ul>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800">预期行为：</h3>
            <ul className="mt-2 space-y-1 text-blue-700 text-sm">
              <li>• 正常状态下每30秒检查一次</li>
              <li>• 检测到问题后切换到10秒间隔</li>
              <li>• 连续3次失败后切换到5秒间隔</li>
              <li>• 恢复正常后逐步回到30秒间隔</li>
              <li>• 网络离线时立即停止服务器检查</li>
              <li>• 页面重新激活时触发检查</li>
            </ul>
          </div>

          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-800">验证要点：</h3>
            <ul className="mt-2 space-y-1 text-green-700 text-sm">
              <li>• 响应时间应该 &lt; 50ms</li>
              <li>• 内存使用应该稳定</li>
              <li>• 成功率应该接近100%</li>
              <li>• 不应该有内存泄漏</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* 连接监控测试组件 */}
      <ConnectionMonitorTest />
    </div>
  );
}