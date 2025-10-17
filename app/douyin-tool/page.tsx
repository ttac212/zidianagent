/**
 * 抖音文案提取工具页面
 * 路径: /douyin-tool
 */

import { DouyinExtractor } from '@/components/douyin/douyin-extractor';

export const metadata = {
  title: '抖音文案提取 - 智点AI平台',
  description: '快速提取抖音视频文案，支持长视频，边下载边转录，基于豆包大模型ASR',
};

export default function DouyinToolPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold">抖音视频文案提取</h1>
        <p className="text-muted-foreground">
          基于豆包大模型的智能语音识别，支持2小时视频，比传统方式快30-50%
        </p>
      </div>
      <DouyinExtractor />
    </div>
  );
}
