#!/bin/bash

# 检查未使用的UI组件
echo "检查未使用的UI组件..."

unused_components=""
for file in components/ui/*.tsx; do
  filename=$(basename "$file" .tsx)
  # 跳过一些基础组件
  if [[ "$filename" == "button" || "$filename" == "input" || "$filename" == "textarea" ]]; then
    continue
  fi

  # 搜索引用
  grep_result=$(grep -r "from [\"']@/components/ui/$filename[\"']" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | grep -v "components/ui/$filename.tsx")

  if [ -z "$grep_result" ]; then
    echo "未使用: $filename"
    unused_components="$unused_components components/ui/$filename.tsx"
  fi
done

echo ""
echo "删除命令："
echo "rm -f$unused_components"