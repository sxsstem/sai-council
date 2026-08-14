#!/bin/bash
# 检查 Council 是否在 3010 端口正常服务
echo "=== 端口 3010 ==="
lsof -nP -iTCP:3010 -sTCP:LISTEN 2>/dev/null || echo "  没服务在监听"

echo ""
echo "=== HTML title ==="
curl -s --max-time 5 http://localhost:3010/ 2>/dev/null | grep -oE "<title[^>]*>[^<]+</title>" || echo "  3010 没响应"

echo ""
echo "=== 当前进程 ==="
ps -ef | grep -E "多模型校验|3010" | grep -v grep | head -5