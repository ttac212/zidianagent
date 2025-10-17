# 抖音视频文案提取功能 - 实现总结

## 📋 功能概述

从抖音分享链接提取视频文案的完整解决方案,使用 GPT-4o Audio Preview 模型进行音频转录。

## 🏗️ 架构设计

### 核心流程

```
抖音分享链接 → 解析视频ID → 获取视频详情 → 下载视频
→ 提取音频 → GPT-4o转录 → LLM优化文案 → 返回结果
```

### 技术栈

- **API路由**: `app/api/douyin/extract-text/route.ts`
- **视频解析**: TikHub API (via `lib/tikhub`)
- **音频提取**: FFmpeg (via `lib/video/video-processor.ts`)
- **语音转录**: GPT-4o Audio Preview (via 302.ai)
- **文案优化**: Claude 3.5 Haiku (via 302.ai)

## 🔑 关键实现

### 1. GPT-4o Audio Preview 集成

```typescript
// 将音频转为base64
const base64Audio = audioBuffer.toString('base64');

// 调用GPT-4o Audio Preview
const response = await fetch('https://api.302.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o-audio-preview',
    modalities: ['text'],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请转录这段音频的内容,只返回转录的文字,不要添加任何说明或解释。',
          },
          {
            type: 'input_audio',
            input_audio: {
              data: base64Audio,
              format: 'mp3',
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  }),
});
```

### 2. SSE流式响应

使用Server-Sent Events实时推送进度更新:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const sendEvent = (type: string, data: any) => {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
      );
    };

    sendEvent('progress', { stage: 'parsing', message: '正在解析抖音链接...' });
    // ... 处理流程
    sendEvent('done', { text, videoInfo, stats });
  },
});
```

## 📊 性能指标

测试视频: 110秒游戏实况

| 阶段 | 耗时 | 说明 |
|------|------|------|
| 解析链接 | <1秒 | 正则提取视频ID |
| 获取详情 | ~38秒 | TikHub API调用 |
| 下载视频 | ~10秒 | 24.36 MB |
| 提取音频 | ~5秒 | FFmpeg处理,1.69 MB |
| **GPT-4o转录** | **~8秒** | ⚡ 核心优势 |
| LLM优化 | ~3秒 | 文案润色 |
| **总计** | **~65秒** | |

## 🎯 优势

1. **速度快**: GPT-4o转录110秒音频仅需8秒
2. **准确度高**: 包含正确标点符号和语气词
3. **架构简洁**: 无需临时文件管理和本地HTTP服务器
4. **统一代理**: 通过302.ai统一API Key管理
5. **实时反馈**: SSE流式推送每个阶段的进度

## 🚀 使用方式

### API调用

```bash
POST http://localhost:3007/api/douyin/extract-text
Content-Type: application/json

{
  "shareLink": "7.15 07/10 Xzt:/ H@V.lp # 瓦瓦 https://v.douyin.com/MUbEduO9AME/ 复制此链接,打开Dou音搜索,直接观看视频!"
}
```

### 测试脚本

```bash
npx tsx scripts/test-douyin-extract-text.ts
```

## 🔧 环境配置

### 必需环境变量

```env
# 302.ai API Key (支持GPT-4o和Claude)
LLM_API_KEY=sk-TejZ4OK9mTGkXlhxvBLuIq8XBysElG1E9EDwirvDHBc8Akon

# TikHub API Key (抖音数据API)
TIKHUB_API_KEY=your_tikhub_key
```

### FFmpeg要求

系统需要安装FFmpeg用于音频提取:

```bash
# Windows
choco install ffmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

## 📝 响应格式

### SSE事件类型

- `progress`: 进度更新 (parsing, analyzing, downloading, extracting, transcribing, optimizing)
- `info`: 阶段完成信息
- `done`: 最终结果
- `error`: 错误信息

### 最终结果

```json
{
  "type": "done",
  "text": "优化后的文案",
  "originalText": "原始转录文本",
  "videoInfo": {
    "title": "视频标题",
    "author": "作者",
    "duration": 110.7,
    "videoId": "7560616811387440443"
  },
  "stats": {
    "totalCharacters": 105
  }
}
```

## ⚠️ 注意事项

1. **API限额**: GPT-4o Audio Preview按token计费,注意控制成本
2. **视频大小**: 建议处理5分钟以内的视频,避免超时
3. **音频格式**: 自动提取为MP3格式 (16kHz, mono, 128kbps)
4. **错误处理**: API返回详细的错误信息,便于调试

## 🔄 版本历史

### v1.0 (2025-10-17)

- ✅ 使用GPT-4o Audio Preview替代豆包ASR
- ✅ 移除临时文件管理和本地HTTP服务器
- ✅ 优化SSE流式响应
- ✅ 集成LLM文案优化

### 废弃方案

- ❌ 豆包ASR API (错误码55000000)
- ❌ OpenAI Whisper via 302.ai (500错误)
- ❌ Elevenlabs STT (缺少task_id)
- ❌ 本地文件服务器方案 (复杂且不必要)

## 📚 相关文档

- [TikHub API文档](https://tikhub.io/docs)
- [GPT-4o Audio文档](https://platform.openai.com/docs/guides/audio)
- [302.ai API文档](https://302.ai/docs)
