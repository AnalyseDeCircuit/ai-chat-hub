# 🚀 AI-Chat-Hub 部署指南

> 完整的本地开发和生产环境部署文档

## 📋 前置要求

### 系统要求
- **操作系统**: macOS / Linux / Windows (WSL2)
- **内存**: 至少 4GB RAM
- **磁盘空间**: 至少 2GB 可用空间

### 软件要求
- **Node.js**: >= 18.0.0 ([下载](https://nodejs.org/))
- **pnpm**: >= 8.0.0 (可选，推荐)
- **Docker Desktop**: >= 24.0.0 ([下载](https://www.docker.com/products/docker-desktop/))
- **Git**: >= 2.0.0

### 验证环境

```bash
# 检查 Node.js 版本
node --version  # 应该 >= v18.0.0

# 检查 Docker
docker --version
docker compose version

# 检查 pnpm（可选）
pnpm --version  # 或使用 npx pnpm
```

---

## 🛠️ 本地开发环境部署

### 第一步：克隆项目

```bash
# 克隆仓库
git clone https://github.com/AnalyseDeCicuit/ai-chat-hub.git
cd ai-chat-hub

### 第二步：安装依赖

```bash
# 方式 1: 使用 npx pnpm（推荐，无需全局安装）
npx pnpm install

# 方式 2: 使用全局 pnpm
pnpm install

# 方式 3: 使用 npm（较慢，但始终可用）
npm install
```

安装过程可能需要 2-5 分钟，请耐心等待。

### 第三步：启动数据库服务

```bash
# 确保 Docker Desktop 正在运行
# 然后启动 PostgreSQL 和 Redis
docker-compose up -d

# 验证服务状态（应该看到 postgres 和 redis 都是 Up 状态）
docker-compose ps

# 检查日志
docker-compose logs -f postgres redis
```

**端口占用检查**：
- PostgreSQL: `5432`
- Redis: `6379`

如果端口被占用，请修改 `docker-compose.yml` 中的端口映射。

### 第四步：配置环境变量

#### 4.1 后端环境变量

```bash
cd packages/backend
cp .env.example .env
```

编辑 `packages/backend/.env`，**必须修改以下关键配置**：

```bash
# ============================================
# 数据库配置
# ============================================
# 注意：密码必须与 docker-compose.yml 中的 POSTGRES_PASSWORD 一致
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_chat_hub?schema=public

# ============================================
# Redis 配置
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# 安全密钥配置（必须修改！）
# ============================================
# JWT Access Token 密钥（至少 32 字符）
JWT_SECRET=请用下方命令生成并替换此处

# JWT Refresh Token 密钥（至少 32 字符）
REFRESH_TOKEN_SECRET=请用下方命令生成并替换此处

# API 密钥加密密钥（必须是 32 字节）
ENCRYPTION_KEY=请用下方命令生成并替换此处

# ============================================
# CORS 配置
# ============================================
# 前端访问地址（Vite 可能会使用 5173 或 5174）
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# ============================================
# 应用配置
# ============================================
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
HOST=0.0.0.0

# ============================================
# Token 过期时间
# ============================================
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ============================================
# 日志配置
# ============================================
LOG_LEVEL=info
```

**⚠️ 安全密钥生成（必须执行！）**

在 macOS/Linux 终端或 Git Bash (Windows) 中运行：

```bash
# 生成 JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 32)"

# 生成 REFRESH_TOKEN_SECRET
echo "REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)"

# 生成 ENCRYPTION_KEY
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

将生成的值复制到 `.env` 文件对应位置。

#### 4.2 前端环境变量

```bash
cd ../frontend

# 创建 .env 文件
cat > .env << EOF
VITE_API_URL=http://localhost:3000/api/v1
EOF
```

或者手动创建 `packages/frontend/.env`：
```bash
VITE_API_URL=http://localhost:3000/api/v1
```

### 第五步：初始化数据库

```bash
# 确保在 packages/backend 目录
cd packages/backend

# 1. 生成 Prisma Client（必须）
npx prisma generate

# 2. 运行数据库迁移（创建表结构）
npx prisma migrate dev --name init

# 如果提示迁移已存在或出错，可以使用：
npx prisma db push

# 3. 填充种子数据（AI 模型列表）
npx prisma db seed
```

**验证数据库**：

```bash
# 打开 Prisma Studio 可视化查看数据库
npx prisma studio
# 浏览器会自动打开 http://localhost:5555
```

### 第六步：启动后端服务

**终端 1 - 后端**：

```bash
# 确保在 packages/backend 目录
cd packages/backend

# 启动开发服务器
npm run dev

# 成功后会看到类似输出：
# Server listening at http://localhost:3000
```

**验证后端**：

```bash
# 新终端，测试健康检查
curl http://localhost:3000/health

# 应该返回：
# {"status":"ok","timestamp":"...","uptime":...}
```

### 第七步：启动前端服务

**终端 2 - 前端**：

```bash
# 新开一个终端
cd packages/frontend

# 启动开发服务器
npm run dev

# 成功后会看到：
# ➜  Local:   http://localhost:5174/
# 或者 5173，取决于端口是否被占用
```

### 第八步：访问应用并配置

1. **打开浏览器**: 访问 http://localhost:5174 (或 5173)

2. **注册账号**:
   - 点击右上角"注册"
   - 填写邮箱和密码（密码至少 8 位）
   - 点击"注册"

3. **登录系统**:
   - 使用刚注册的邮箱和密码登录

4. **配置 API 密钥**:
   - 点击左侧边栏"API 密钥管理"
   - 点击"添加新密钥"
   - 选择 AI 提供商（如 OpenAI）
   - 粘贴您的 API Key
   - 点击"保存"

   > 获取 API 密钥：
   > - OpenAI: https://platform.openai.com/api-keys
   > - Claude: https://console.anthropic.com/
   > - Gemini: https://makersuite.google.com/app/apikey
   > - DeepSeek: https://platform.deepseek.com/
   > - 智谱 AI: https://open.bigmodel.cn/
   > - Moonshot: https://platform.moonshot.cn/

5. **开始对话**:
   - 返回聊天页面
   - 点击右上角选择模型
   - 输入消息开始对话！

---

## 🎯 验证部署

### 服务检查清单

```bash
# ✅ PostgreSQL
docker exec postgres pg_isready
# 应该输出: /var/run/postgresql:5432 - accepting connections

# ✅ Redis
docker exec redis redis-cli ping
# 应该输出: PONG

# ✅ 后端 API
curl http://localhost:3000/health
# 应该返回: {"status":"ok",...}

# ✅ 前端
curl http://localhost:5174
# 应该返回 HTML 内容
```

### 功能测试

- [ ] 用户注册和登录
- [ ] API 密钥添加和管理
- [ ] 创建新对话
- [ ] 发送消息并接收回复
- [ ] 切换不同模型
- [ ] 查看使用统计
- [ ] 切换主题

---

## 🔧 故障排查

### 问题 1: Docker 无法启动

**症状**:
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
ERROR: Cannot connect to Docker daemon
```

**解决方案**:
1. **macOS**: 打开 Docker Desktop 应用，等待右上角图标变绿
2. **Linux**: 启动 Docker 服务
   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker
   ```
3. **Windows**: 启动 Docker Desktop，确保 WSL2 后端已启用

**验证**:
```bash
docker ps  # 应该能正常列出容器
```

### 问题 2: 端口被占用

**症状**:
```
Error: Port 3000 is already in use
Error: Port 5432 is already in use
```

**解决方案**:

**后端端口 (3000)**:
```bash
# macOS/Linux 查找进程
lsof -i :3000

# Windows PowerShell
netstat -ano | findstr :3000

# 杀死进程 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# 或修改端口
# 编辑 packages/backend/.env
PORT=3001
```

**数据库端口 (5432)**:
```bash
# 停止本地 PostgreSQL
# macOS
brew services stop postgresql

# Linux
sudo systemctl stop postgresql

# 或修改 docker-compose.yml 端口映射
# "5433:5432" 然后修改 DATABASE_URL
```

### 问题 3: 数据库连接失败

**症状**:
```
Error: P1001: Can't reach database server
Error: Authentication failed
```

**解决方案**:

1. **检查容器状态**:
   ```bash
   docker-compose ps
   # postgres 应该是 Up 状态
   ```

2. **检查密码一致性**:
   - `docker-compose.yml` 中的 `POSTGRES_PASSWORD`
   - `packages/backend/.env` 中的 `DATABASE_URL` 密码
   - **必须完全一致**

3. **重启数据库**:
   ```bash
   docker-compose restart postgres
   
   # 或完全重建
   docker-compose down
   docker-compose up -d
   ```

4. **查看日志**:
   ```bash
   docker-compose logs postgres
   ```

### 问题 4: Prisma 迁移失败

**症状**:
```
Error: P3009: migrate.lock file is present
Error: Migration failed to apply
```

**解决方案**:

**方案 A - 重置迁移（开发环境）**:
```bash
cd packages/backend

# 删除迁移记录
rm -rf prisma/migrations

# 重新初始化
npx prisma migrate dev --name init
```

**方案 B - 强制推送 Schema**:
```bash
npx prisma db push --force-reset
```

**方案 C - 完全重置数据库**:
```bash
# 警告：会删除所有数据
npx prisma migrate reset

# 或手动重建
docker-compose down -v
docker-compose up -d
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 问题 5: CORS 错误

**症状**:
```
Access to XMLHttpRequest ... has been blocked by CORS policy
No 'Access-Control-Allow-Origin' header is present
```

**解决方案**:

1. **检查前端端口**:
   ```bash
   # 前端终端输出会显示实际端口
   ➜  Local:   http://localhost:5174/  # 可能是 5173 或 5174
   ```

2. **更新后端 CORS 配置**:
   ```bash
   # 编辑 packages/backend/.env
   CORS_ORIGIN=http://localhost:5173,http://localhost:5174
   
   # 重启后端
   # Ctrl+C 停止，然后 npm run dev
   ```

3. **清除浏览器缓存**:
   - Chrome/Edge: Ctrl+Shift+Delete
   - 或使用无痕模式 (Ctrl+Shift+N)

4. **验证后端**:
   ```bash
   curl -I http://localhost:3000/health
   # 检查是否有 Access-Control-Allow-Origin 头
   ```

### 问题 6: 加密密钥错误

**症状**:
```
Error: Encryption key must be 32 bytes
ZodError: JWT_SECRET must be at least 32 characters
```

**解决方案**:

```bash
# 重新生成所有密钥
cd packages/backend

# 在 macOS/Linux
echo "JWT_SECRET=\"$(openssl rand -base64 32)\"" >> .env
echo "REFRESH_TOKEN_SECRET=\"$(openssl rand -base64 32)\"" >> .env
echo "ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> .env

# 在 Windows (PowerShell)
# 手动运行每个命令并复制到 .env

# 重启后端
```

### 问题 7: pnpm 安装失败

**症状**:
```
ERR_PNPM_FETCH_404
Package not found
```

**解决方案**:

```bash
# 清理缓存
npx pnpm store prune

# 删除 node_modules 和 lockfile
rm -rf node_modules pnpm-lock.yaml

# 重新安装
npx pnpm install

# 如果还是失败，使用 npm
rm -rf node_modules package-lock.json
npm install
```

### 问题 8: 前端编译错误

**症状**:
```
Failed to resolve import
Module not found
```

**解决方案**:

```bash
cd packages/frontend

# 清理依赖
rm -rf node_modules .vite

# 重新安装
npm install

# 重新构建 shared 包
cd ../shared
npm run build

# 返回前端重新启动
cd ../frontend
npm run dev
```

### 问题 9: Token 过期或认证失败

**症状**:
- 登录后立即退出
- 请求返回 401 Unauthorized

**解决方案**:

1. **清除浏览器存储**:
   - F12 打开开发者工具
   - Application → Local Storage → 清除
   - Application → Session Storage → 清除

2. **检查 JWT 配置**:
   ```bash
   # packages/backend/.env
   JWT_EXPIRES_IN=15m
   REFRESH_TOKEN_EXPIRES_IN=7d
   ```

3. **重新登录**

### 问题 10: AI 模型调用失败

**症状**:
```
Error: 401 Invalid API key
Error: 429 Rate limit exceeded
```

**解决方案**:

1. **验证 API Key**:
   - 前往对应平台检查密钥是否有效
   - 检查是否有余额或配额

2. **检查网络**:
   ```bash
   # 测试是否能访问 OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **使用代理**（如果在中国大陆）:
   ```bash
   # 编辑 packages/backend/.env
   HTTP_PROXY=http://127.0.0.1:7890
   HTTPS_PROXY=http://127.0.0.1:7890
   ```

4. **查看后端日志**:
   - 后端终端会显示详细的错误信息

---

## 🌐 生产环境部署

### 安全配置清单

**在部署到生产环境之前，请务必完成以下安全配置：**

- [ ] ✅ 使用强随机密钥（JWT_SECRET、ENCRYPTION_KEY 等）
- [ ] ✅ 设置 `NODE_ENV=production`
- [ ] ✅ 使用 HTTPS（配置 SSL/TLS 证书）
- [ ] ✅ 配置防火墙规则
- [ ] ✅ 启用 API 速率限制
- [ ] ✅ 使用专业的数据库服务（不要用 Docker）
- [ ] ✅ 配置自动备份
- [ ] ✅ 设置监控和日志收集
- [ ] ✅ 使用反向代理（Nginx/Caddy）
- [ ] ✅ 配置 CORS 白名单

### 方案 A: Docker Compose 生产部署

#### 1. 构建镜像

创建 `Dockerfile` (后端):

```dockerfile
# packages/backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma Client 和构建
RUN npx prisma generate
RUN pnpm build

# 生产镜像
FROM node:18-alpine

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

创建 `Dockerfile` (前端):

```dockerfile
# packages/frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml* ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# Nginx 服务镜像
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf` (前端):

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 2. 生产环境 docker-compose.yml

创建 `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    restart: always
    env_file:
      - ./packages/backend/.env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    restart: always
    depends_on:
      - backend
    networks:
      - app-network
    ports:
      - "80:80"

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

#### 3. 生产环境变量

创建 `packages/backend/.env.production`:

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 生产数据库（使用 Docker service 名称）
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}

# Redis（使用 Docker service 名称）
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# 强随机密钥（必须生成）
JWT_SECRET=${PROD_JWT_SECRET}
REFRESH_TOKEN_SECRET=${PROD_REFRESH_TOKEN_SECRET}
ENCRYPTION_KEY=${PROD_ENCRYPTION_KEY}

# CORS（您的域名）
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# 日志
LOG_LEVEL=warn

# JWT 过期时间
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

#### 4. 部署命令

```bash
# 构建并启动
docker-compose -f docker-compose.prod.yml up -d --build

# 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 停止
docker-compose -f docker-compose.prod.yml down
```

### 方案 B: 传统 VPS 部署

#### 1. 安装依赖

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql redis-server nginx

# 安装 pnpm
npm install -g pnpm

# 安装 PM2（进程管理器）
npm install -g pm2
```

#### 2. 配置 PostgreSQL

```bash
# 创建数据库用户
sudo -u postgres psql
CREATE USER ai_chat_admin WITH PASSWORD 'strong_password';
CREATE DATABASE ai_chat_hub OWNER ai_chat_admin;
GRANT ALL PRIVILEGES ON DATABASE ai_chat_hub TO ai_chat_admin;
\q
```

#### 3. 配置 Nginx

```nginx
# /etc/nginx/sites-available/ai-chat-hub
server {
    listen 80;
    server_name yourdomain.com;

    # 前端
    location / {
        root /var/www/ai-chat-hub/frontend;
        try_files $uri /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/ai-chat-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. 部署应用

```bash
# 克隆代码
cd /var/www
git clone <your-repo> ai-chat-hub
cd ai-chat-hub

# 安装依赖
pnpm install

# 构建
cd packages/backend
pnpm build

cd ../frontend
pnpm build

# 配置环境变量
cd ../backend
cp .env.example .env.production
# 编辑 .env.production

# 运行迁移
npx prisma migrate deploy

# 使用 PM2 启动
pm2 start dist/index.js --name "ai-chat-backend"
pm2 save
pm2 startup
```

#### 5. 配置 SSL (Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

### 数据库备份策略

#### 自动备份脚本

创建 `/usr/local/bin/backup-db.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/ai-chat-hub"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="ai_chat_hub"
DB_USER="ai_chat_admin"

mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U $DB_USER -Fc $DB_NAME > $BACKUP_DIR/backup_$DATE.dump

# 删除 7 天前的备份
find $BACKUP_DIR -name "backup_*.dump" -mtime +7 -delete

echo "Backup completed: backup_$DATE.dump"
```

```bash
# 添加执行权限
chmod +x /usr/local/bin/backup-db.sh

# 添加到 crontab（每天凌晨 2 点执行）
crontab -e
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
```

#### 恢复备份

```bash
# 从 Docker 备份
docker exec -t postgres pg_dump -U postgres -Fc ai_chat_hub > backup.dump

# 恢复
docker exec -i postgres pg_restore -U postgres -d ai_chat_hub -c < backup.dump

# 从 VPS 备份
pg_restore -U ai_chat_admin -d ai_chat_hub -c backup.dump
```

---

## 📊 监控和日志

### 应用监控

#### 使用 PM2 监控（VPS 部署）

```bash
# 查看运行状态
pm2 status

# 查看日志
pm2 logs ai-chat-backend

# 监控面板
pm2 monit

# 重启应用
pm2 restart ai-chat-backend

# 停止应用
pm2 stop ai-chat-backend

# 查看详细信息
pm2 info ai-chat-backend
```

#### Docker 监控

```bash
# 查看容器状态
docker-compose ps

# 查看资源使用
docker stats

# 查看日志（实时）
docker-compose logs -f backend

# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 导出日志
docker-compose logs > app.log
```

### 性能监控

推荐使用以下工具：

- **Prometheus + Grafana**: 指标收集和可视化
- **Sentry**: 错误追踪和性能监控
- **ELK Stack**: 日志聚合和分析
- **Uptime Kuma**: 服务可用性监控

## 🧹 维护和清理

### 日常维护

```bash
# 更新应用代码
cd ai-chat-hub
git pull origin main

# 重新构建并部署
docker-compose -f docker-compose.prod.yml up -d --build

# 运行数据库迁移
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### 数据库维护

```bash
# 优化数据库（PostgreSQL）
docker exec postgres psql -U postgres -d ai_chat_hub -c "VACUUM ANALYZE;"

# 检查数据库大小
docker exec postgres psql -U postgres -d ai_chat_hub -c "
  SELECT pg_size_pretty(pg_database_size('ai_chat_hub'));"

# 清理旧会话（根据实际需求）
docker exec postgres psql -U postgres -d ai_chat_hub -c "
  DELETE FROM \"Session\" WHERE \"updatedAt\" < NOW() - INTERVAL '90 days';"
```

### Docker 清理

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 清理未使用的网络
docker network prune

# 清理所有未使用资源
docker system prune -a --volumes
```

### 日志轮转

创建 `/etc/logrotate.d/ai-chat-hub`:

```
/var/log/ai-chat-hub/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🔄 更新和升级

### 应用更新流程

1. **备份数据库**:
   ```bash
   # Docker
   docker exec postgres pg_dump -U postgres -Fc ai_chat_hub > backup_before_update.dump
   
   # VPS
   pg_dump -U ai_chat_admin -Fc ai_chat_hub > backup_before_update.dump
   ```

2. **拉取最新代码**:
   ```bash
   git pull origin main
   ```

3. **更新依赖**:
   ```bash
   pnpm install
   ```

4. **运行迁移**:
   ```bash
   cd packages/backend
   npx prisma migrate deploy
   ```

5. **重新构建**:
   ```bash
   # Docker
   docker-compose -f docker-compose.prod.yml up -d --build
   
   # VPS
   cd packages/backend && pnpm build
   cd ../frontend && pnpm build
   pm2 restart ai-chat-backend
   ```

6. **验证**:
   ```bash
   curl http://localhost:3000/health
   ```

### 回滚流程

如果更新出现问题：

```bash
# 1. 回滚代码
git reset --hard HEAD~1

# 2. 恢复数据库
docker exec -i postgres pg_restore -U postgres -d ai_chat_hub -c < backup_before_update.dump

# 3. 重新构建
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🚨 应急响应

### 服务宕机

```bash
# 1. 检查服务状态
docker-compose ps  # 或 pm2 status

# 2. 查看日志
docker-compose logs --tail=100 backend  # 或 pm2 logs

# 3. 重启服务
docker-compose restart  # 或 pm2 restart all

# 4. 如果无法恢复，回滚到上一个稳定版本
git log --oneline  # 查看提交历史
git reset --hard <stable-commit-hash>
docker-compose up -d --build
```

### 数据库锁死

```bash
# 查看活动连接
docker exec postgres psql -U postgres -d ai_chat_hub -c "
  SELECT pid, usename, application_name, state, query 
  FROM pg_stat_activity 
  WHERE datname = 'ai_chat_hub';"

# 终止特定连接
docker exec postgres psql -U postgres -d ai_chat_hub -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = 'ai_chat_hub' AND pid <> pg_backend_pid();"
```

### 磁盘空间不足

```bash
# 检查磁盘使用
df -h

# 查找大文件
du -sh /* | sort -hr | head -10

# 清理 Docker
docker system prune -a --volumes

# 清理日志
sudo journalctl --vacuum-time=3d
sudo truncate -s 0 /var/log/*.log

# 清理 npm 缓存
pnpm store prune
npm cache clean --force
```

## 📞 获取帮助

### 自助资源

- **文档**: [README.md](README.md)
- **开发计划**: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
- **安全指南**: [SECURITY.md](SECURITY.md)
- **时间轴**: [TIMELINE.md](TIMELINE.md)

### 问题反馈

如遇到问题：

1. **查看故障排查**: 本文档的"故障排查"部分
2. **查看日志**: Docker logs 或 PM2 logs
3. **搜索 Issues**: GitHub Issues
4. **提交新 Issue**: 附上详细的错误信息、环境信息和操作步骤

### 社区支持

- GitHub Issues: 报告 Bug 或请求新功能
- GitHub Discussions: 讨论和问答
- Pull Requests: 贡献代码

## ✅ 部署检查清单

### 开发环境

- [ ] Docker Desktop 运行正常
- [ ] PostgreSQL 和 Redis 容器启动
- [ ] 数据库迁移成功
- [ ] 后端 API 健康检查通过
- [ ] 前端可以正常访问
- [ ] 注册和登录功能正常
- [ ] API 密钥管理正常
- [ ] 聊天功能正常

### 生产环境

- [ ] 所有密钥已更换为强随机值
- [ ] NODE_ENV=production
- [ ] HTTPS 已配置（SSL 证书）
- [ ] CORS 配置正确
- [ ] 防火墙规则已设置
- [ ] 数据库备份已配置
- [ ] 监控已部署
- [ ] 日志轮转已配置
- [ ] PM2/Docker 自动重启已启用
- [ ] 域名 DNS 已配置
- [ ] 负载测试通过

---

<div align="center">

**🎉 部署完成！祝您使用愉快！**

如有问题，请查看上方的故障排查部分或提交 Issue。

[返回首页](README.md) | [安全指南](SECURITY.md) | [开发计划](DEVELOPMENT_PLAN.md)

Made with ❤️ by AI-Chat-Hub Team

</div>
