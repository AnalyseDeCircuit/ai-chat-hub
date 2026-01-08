# 🚀 生产环境部署指南

## 环境要求

### 服务器配置
- **CPU**: 2 核心（推荐 4 核心）
- **内存**: 4GB（推荐 8GB）
- **存储**: 20GB SSD
- **带宽**: 100Mbps+
- **操作系统**: Ubuntu 22.04 LTS / Debian 12

### 依赖服务
- **Node.js**: >= 18.x
- **PostgreSQL**: >= 16.x
- **Redis**: >= 7.x
- **Docker**: >= 24.x（可选）
- **Nginx**: 用作反向代理

## 环境变量配置

### 后端环境变量

创建 `/opt/ai-chat-hub/.env`：

```bash
# ============ 服务配置 ============
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# ============ 数据库配置 ============
# 使用 SSL 连接
DATABASE_URL=postgresql://username:password@db-host:5432/ai_chat_hub?sslmode=require

# ============ Redis 配置 ============
REDIS_URL=redis://redis-host:6379

# ============ JWT 配置 ============
# 生成命令: openssl rand -base64 32
JWT_SECRET=your-production-jwt-secret-min-32-chars
REFRESH_TOKEN_SECRET=your-production-refresh-token-secret-min-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ============ 加密密钥 ============
# 生成命令: openssl rand -base64 32
ENCRYPTION_KEY=your-production-encryption-key-32-bytes

# ============ 速率限制 ============
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# ============ CORS配置 ============
CORS_ORIGIN=https://your-domain.com

# ============ 日志配置 ============
LOG_LEVEL=info
```

### 前端环境变量

创建 `packages/frontend/.env.production`：

```bash
VITE_API_URL=https://api.your-domain.com/api/v1
```

## 数据库设置

### PostgreSQL 安装

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-16

# 创建数据库和用户
sudo -u postgres psql

CREATE DATABASE ai_chat_hub;
CREATE USER ai_chat_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE ai_chat_hub TO ai_chat_user;

# 启用 SSL
ALTER SYSTEM SET ssl = on;
\q

sudo systemctl restart postgresql
```

### 数据库迁移

```bash
cd /opt/ai-chat-hub/packages/backend
npx prisma migrate deploy
npx prisma db seed
```

## Redis 设置

```bash
# 安装 Redis
sudo apt install redis-server

# 配置（可选）
sudo vim /etc/redis/redis.conf

# 设置密码（推荐）
requirepass your-redis-password

# 重启
sudo systemctl restart redis
sudo systemctl enable redis
```

## 应用部署

### 方式 1: PM2 部署（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 构建应用
cd /opt/ai-chat-hub
pnpm install --prod
pnpm build

# 启动后端
cd packages/backend
pm2 start dist/index.js --name ai-chat-backend

# 保存 PM2 配置
pm2 save
pm2 startup
```

**PM2 配置文件** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [
    {
      name: 'ai-chat-backend',
      script: './dist/index.js',
      cwd: '/opt/ai-chat-hub/packages/backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
```

### 方式 2: Docker 部署

```bash
# 构建镜像
docker build -t ai-chat-backend:latest -f packages/backend/Dockerfile .
docker build -t ai-chat-frontend:latest -f packages/frontend/Dockerfile .

# 使用 docker-compose 启动
docker-compose -f docker-compose.prod.yml up -d
```

**docker-compose.prod.yml**:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ai_chat_hub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  backend:
    image: ai-chat-backend:latest
    env_file: .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2

  frontend:
    image: ai-chat-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Nginx 配置

```nginx
# /etc/nginx/sites-available/ai-chat-hub

# 后端 API
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}

# 前端
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /var/www/ai-chat-hub;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name api.your-domain.com your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/ai-chat-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot --nginx -d api.your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 监控与日志

### 日志查看

```bash
# PM2 日志
pm2 logs ai-chat-backend

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 系统日志
journalctl -u ai-chat-backend -f
```

### 健康检查

```bash
# API 健康检查
curl https://api.your-domain.com/health

# 数据库连接
psql -h localhost -U ai_chat_user -d ai_chat_hub -c "SELECT 1;"

# Redis 连接
redis-cli -a your-redis-password ping
```

## 备份策略

### 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/postgres"
DB_NAME="ai_chat_hub"

pg_dump $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# 保留最近 30 天的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

添加到 crontab：

```bash
# 每天凌晨 2 点备份
0 2 * * * /opt/scripts/backup-database.sh
```

### Redis 备份

Redis 会自动持久化到 `/var/lib/redis/dump.rdb`，定期备份此文件即可。

## 性能优化

### 数据库索引

确保以下索引存在（已在 Prisma schema 中定义）：

```sql
-- 用户表
CREATE INDEX idx_users_email ON users(email);

-- 会话表
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);

-- 消息表
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- 统计表
CREATE INDEX idx_usage_stats_user_date ON usage_stats(user_id, stat_date DESC);
```

### Node.js 优化

```bash
# 增加文件描述符限制
ulimit -n 65536

# PM2 集群模式
pm2 start ecosystem.config.js
```

### PostgreSQL 调优

```sql
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
```

## 安全检查清单

- [ ] 所有密钥已更新为生产密钥
- [ ] 数据库使用 SSL 连接
- [ ] Redis 设置了密码
- [ ] Nginx 启用 HTTPS
- [ ] 防火墙已配置（仅开放 80, 443, 22）
- [ ] SSH 密钥登录（禁用密码登录）
- [ ] 定期更新系统和依赖
- [ ] 设置备份自动化
- [ ] 配置监控告警

## 故障排查

### 应用无法启动

```bash
# 检查日志
pm2 logs ai-chat-backend --lines 100

# 检查端口占用
sudo lsof -i :3000

# 检查环境变量
pm2 env 0
```

### 数据库连接失败

```bash
# 测试连接
psql -h localhost -U ai_chat_user -d ai_chat_hub

# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 查看 PostgreSQL 日志
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### 内存不足

```bash
# 查看内存使用
free -h
pm2 monit

# 调整 PM2 配置
# 减少实例数或设置 max_memory_restart
```

## 更新部署

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install --prod

# 构建
pnpm build

# 数据库迁移
cd packages/backend
npx prisma migrate deploy

# 重启应用
pm2 restart ai-chat-backend

# 或使用零停机重启
pm2 reload ai-chat-backend
```

## 回滚

```bash
# 回滚到上一个版本
git checkout <previous-commit>
pnpm install --prod
pnpm build
pm2 restart ai-chat-backend
```

---

**生产环境部署完成！** 🎉

记得定期检查日志、监控和备份！
