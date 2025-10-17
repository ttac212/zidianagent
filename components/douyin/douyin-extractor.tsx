/**
 * 抖音文案提取组件
 * 演示如何使用 useDouyinExtraction Hook
 */

'use client';

import { useState } from 'react';
import { useDouyinExtraction } from '@/hooks/use-douyin-extraction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function DouyinExtractor() {
  const [shareLink, setShareLink] = useState('');
  const { isExtracting, progress, partialResults, result, error, extractText, cancel, reset } =
    useDouyinExtraction();

  const handleExtract = async () => {
    if (!shareLink.trim()) {
      toast.error('请输入抖音分享链接');
      return;
    }

    await extractText(shareLink);
  };

  const handleCopy = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success('文案已复制到剪贴板');
    }
  };

  const handleDownload = () => {
    if (result?.text) {
      const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.videoInfo.title || '抖音文案'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('文件已下载');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>抖音视频文案提取</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 输入区域 */}
          <div className="flex gap-2">
            <Input
              placeholder="粘贴抖音分享链接..."
              value={shareLink}
              onChange={(e) => setShareLink(e.target.value)}
              disabled={isExtracting}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isExtracting) {
                  handleExtract();
                }
              }}
            />
            {isExtracting ? (
              <Button onClick={cancel} variant="destructive">
                取消
              </Button>
            ) : (
              <Button onClick={handleExtract} disabled={!shareLink.trim()}>
                提取文案
              </Button>
            )}
          </div>

          {/* 进度显示 */}
          {isExtracting && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progress.message}</span>
                <span className="font-medium">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} className="h-2" />
              {progress.current !== undefined && progress.total !== undefined && (
                <div className="text-xs text-muted-foreground">
                  进度: {progress.current}/{progress.total}
                </div>
              )}
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 实时部分结果 */}
          {partialResults.length > 0 && !result && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在识别中... ({partialResults.length} 段已完成)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 space-y-2 overflow-y-auto text-sm">
                  {partialResults.map((partial, index) => (
                    <div key={index} className="rounded border bg-background p-2">
                      <div className="mb-1 text-xs text-muted-foreground">
                        第 {partial.index + 1} 段 ({partial.timestamp.toFixed(1)}秒)
                      </div>
                      <div>{partial.text}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 最终结果 */}
          {result && (
            <div className="space-y-4">
              {/* 视频信息 */}
              {result.videoInfo.title && (
                <Card className="bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">标题：</span>
                        {result.videoInfo.title}
                      </div>
                      {result.videoInfo.author && (
                        <div>
                          <span className="font-medium">作者：</span>
                          {result.videoInfo.author}
                        </div>
                      )}
                      {result.videoInfo.duration && (
                        <div>
                          <span className="font-medium">时长：</span>
                          {result.videoInfo.duration.toFixed(1)}秒
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 文案内容 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      提取完成
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={handleCopy} variant="outline" size="sm">
                        <Copy className="mr-2 h-4 w-4" />
                        复制
                      </Button>
                      <Button onClick={handleDownload} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        下载
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/50 p-4 text-sm">
                    {result.text}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span>共 {result.stats.totalCharacters} 字</span>
                    <span>
                      {result.stats.successSegments}/{result.stats.totalSegments} 段识别成功
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* 重新提取按钮 */}
              <Button onClick={reset} variant="outline" className="w-full">
                提取新视频
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. 在抖音APP中找到想要提取文案的视频</p>
          <p>2. 点击分享按钮，选择&ldquo;复制链接&rdquo;</p>
          <p>3. 粘贴链接到上方输入框，点击&ldquo;提取文案&rdquo;</p>
          <p>4. 等待处理完成，即可复制或下载文案</p>
          <p className="mt-4 rounded bg-yellow-500/10 p-2 text-yellow-700">
            💡 提示：支持2小时以内的视频，处理速度比传统方式快30-50%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
