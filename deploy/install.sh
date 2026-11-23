#!/bin/bash
# ============================================================
# 男科教育智能体 · 一键部署脚本（宝塔终端执行）
# 用法：
#   cd /www/wwwroot/education.bsnk.cloud && bash deploy/install.sh
# 前提：项目文件已上传、Node.js ≥ 18 已安装（宝塔软件商店）
# 完成后仍需在宝塔面板：建站 + 反向代理 + SSL（见宝塔部署指南第六节）
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
echo "==> 项目目录：$APP_DIR"

echo "==> 1/5 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "错误：未检测到 Node.js。请先在宝塔「软件商店」安装 Node.js 版本管理器（Node 18+），并确保 node 命令可用。"
  exit 1
fi
NODE_V="$(node -v)"
echo "    Node 版本：$NODE_V"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  echo "错误：需要 Node.js ≥ 18，当前 $NODE_V"
  exit 1
fi

echo "==> 2/5 检查 .env"
if [ ! -f .env ]; then
  echo "    警告：缺少 .env 文件。请执行：cp .env.example .env 并填入 DEEPSEEK_API_KEY"
else
  grep -q '^DEEPSEEK_API_KEY=sk-' .env && echo "    .env 已配置 API Key" || echo "    警告：.env 中 DEEPSEEK_API_KEY 似乎未配置（应为 sk- 开头）"
fi

echo "==> 3/5 安装/检查 PM2"
# 若之前已用 ~/.npm-global 安装过 pm2，先将其加入 PATH，保证本脚本能定位到
[ -d "$HOME/.npm-global/bin" ] && export PATH="$HOME/.npm-global/bin:$PATH"

if command -v pm2 >/dev/null 2>&1; then
  echo "    PM2 已安装：$(command -v pm2)"
else
  echo "    正在安装 pm2 ..."
  # 权限兜底：全局目录（如 /usr/lib/node_modules）不可写时，自动切换到用户级目录避免 EACCES
  if ! npm install -g pm2; then
    echo "    全局安装失败（多为权限不足），改用用户级目录 ~/.npm-global 重试 ..."
    npm config set prefix "$HOME/.npm-global"
    export PATH="$HOME/.npm-global/bin:$PATH"
    npm install -g pm2
  fi
  echo "    PM2 安装完成：$(command -v pm2)"
fi

echo "==> 4/5 启动服务（PM2）"
if pm2 describe andrology-edu >/dev/null 2>&1; then
  echo "    已存在 andrology-edu 进程，执行 restart ..."
  pm2 restart andrology-edu
else
  pm2 start deploy/ecosystem.config.cjs --env production
fi
pm2 save
echo "    配置开机自启（如输出命令请复制执行）..."
pm2 startup || true

echo "==> 5/5 自检"
sleep 2
TOKEN="$(grep -E '^ACCESS_TOKEN=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [ -n "$TOKEN" ]; then
  echo "    /api/health（带口令）响应："
  curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3360/api/health && echo "" || { echo "    自检失败，查看日志：pm2 logs andrology-edu"; exit 1; }
else
  echo "    /api/health 响应："
  curl -s http://127.0.0.1:3360/api/health && echo "" || { echo "    自检失败，查看日志：pm2 logs andrology-edu"; exit 1; }
fi

echo ""
echo "============================================================"
echo " 部署完成（后端部分）。剩余步骤请在宝塔面板操作："
echo "  1) 网站 → 添加站点：education.bsnk.cloud"
echo "  2) 站点 → 反向代理 → 目标 http://127.0.0.1:3360"
echo "  3) 站点 → SSL → Let's Encrypt 申请证书（强制 HTTPS）"
echo "  4) 防火墙/安全组：仅开放 80/443，不要开放 3360"
echo "  5) 访问 https://education.bsnk.cloud 验证"
echo "============================================================"
