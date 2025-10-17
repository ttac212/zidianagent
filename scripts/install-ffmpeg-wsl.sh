#!/bin/bash

# WSL环境FFmpeg安装脚本

echo "🚀 开始安装FFmpeg..."
echo ""

# 检查是否在WSL环境
if ! grep -qi microsoft /proc/version; then
    echo "⚠️  警告: 此脚本仅适用于WSL环境"
    echo "   如果您在Windows上，FFmpeg可能已经安装"
    exit 1
fi

# 检查是否已安装
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg已经安装!"
    ffmpeg -version | head -n 1
    exit 0
fi

# 更新包列表
echo "1️⃣ 更新包列表..."
sudo apt-get update

# 安装FFmpeg
echo ""
echo "2️⃣ 安装FFmpeg..."
sudo apt-get install -y ffmpeg

# 验证安装
echo ""
echo "3️⃣ 验证安装..."
if command -v ffmpeg &> /dev/null; then
    echo ""
    echo "✅ FFmpeg安装成功!"
    ffmpeg -version | head -n 1
    echo ""
    echo "📝 下一步:"
    echo "   运行测试: npx tsx scripts/test-doubao-asr.ts"
    echo "   或启动服务: pnpm dev"
else
    echo ""
    echo "❌ 安装失败，请手动安装:"
    echo "   sudo apt-get install ffmpeg"
fi
