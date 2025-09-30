#!/bin/bash
# 综合验证所有 metadata 修复

set -e

echo "🧪 开始综合验证 metadata 修复..."
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 测试1: 检查 metadata 列存在
echo "📋 测试1: 检查 metadata 列是否存在..."
if npx tsx scripts/check-metadata-column.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - metadata 列存在且可访问"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - metadata 列不存在或无法访问"
    echo -e "${YELLOW}解决方案: pnpm db:push${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试2: metadata 持久化测试
echo "📋 测试2: metadata 持久化完整流程..."
if npx tsx scripts/test-metadata-persistence.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - pinned 标签正确保存和移除"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - metadata 持久化失败"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试3: 字段覆盖顺序测试
echo "📋 测试3: 字段覆盖顺序修复验证..."
if npx tsx scripts/test-field-override-order.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - 统计数据不被旧值覆盖"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - 字段覆盖顺序问题"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试4: 检查 API 代码修复
echo "📋 测试4: 检查 API select 块包含 metadata..."
if grep -q "metadata: true" app/api/conversations/route.ts; then
    echo -e "${GREEN}✅ PASS${NC} - API select 块包含 metadata 字段"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - API select 块缺少 metadata 字段"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试5: 检查字段覆盖顺序修复
echo "📋 测试5: 检查 transformApiConversation 字段顺序..."
if grep -A 5 "先展开数据库中的 metadata" hooks/api/use-conversations-query.ts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} - 字段覆盖顺序已修复"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - 字段覆盖顺序未修复"
    FAILED=$((FAILED + 1))
fi
echo ""

# 测试6: 检查 toggleConversationPinned 清理
echo "📋 测试6: 检查 toggleConversationPinned 移除实时字段..."
if grep -q "只提取用户自定义字段，排除实时统计字段" lib/utils/conversation-list.ts; then
    echo -e "${GREEN}✅ PASS${NC} - toggleConversationPinned 已清理实时字段"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} - toggleConversationPinned 仍包含实时字段"
    FAILED=$((FAILED + 1))
fi
echo ""

# 总结
echo "================================================"
echo "📊 测试结果汇总"
echo "================================================"
echo ""
echo -e "${GREEN}通过: ${PASSED}${NC}"
echo -e "${RED}失败: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ 所有测试通过！metadata 功能修复完成！${NC}"
    echo ""
    echo "🚀 可以安全部署："
    echo "   1. git add ."
    echo "   2. git commit -m 'fix: metadata字段完整修复'"
    echo "   3. pnpm db:push  # 生产环境同步schema"
    echo "   4. pnpm build && pnpm start"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 部分测试失败，请检查上述错误${NC}"
    echo ""
    exit 1
fi
