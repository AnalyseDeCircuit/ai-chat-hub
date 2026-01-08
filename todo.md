# 多模型协作AI聊天平台 - 技术方案文档

> 编制日期：2026年1月8日  
> 版本：v1.0

---

## 1. 系统架构图（四层结构）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           【表现层 - Presentation Layer】                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Web客户端   │  │  移动端H5   │  │  桌面客户端  │  │  第三方集成(SDK)    │ │
│  │  (React/Vue) │  │  (响应式)   │  │  (Electron) │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                      │                                       │
│  功能：用户界面、实时聊天、模型切换、密钥管理、会话历史展示                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ WebSocket/HTTPS
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                           【网关层 - Gateway Layer】                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  API网关    │  │  负载均衡   │  │  认证鉴权   │  │  限流/熔断          │ │
│  │  (Kong/    │  │  (Nginx)    │  │  (JWT)      │  │  (Sentinel)         │ │
│  │   Traefik) │  │             │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                      │                                       │
│  功能：请求路由、身份验证、流量控制、SSL终结、WebSocket代理                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ gRPC/HTTP
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                           【业务层 - Business Layer】                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ 用户服务  │ │ 会话服务  │ │ 消息服务  │ │ 模型路由  │ │  统计分析     │ │
│  │ User      │ │ Session   │ │ Message   │ │ Model     │ │  Analytics    │ │
│  │ Service   │ │ Service   │ │ Service   │ │ Router    │ │  Service      │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────────┘ │
│  ┌───────────┐ ┌───────────┐ ┌───────────────────────────────────────────┐ │
│  │ 密钥管理  │ │ 上下文    │ │              MCP适配器层                   │ │
│  │ Key       │ │ Context   │ │  ┌─────────┐ ┌─────────┐ ┌─────────────┐  │ │
│  │ Vault     │ │ Manager   │ │  │ OpenAI  │ │ Claude  │ │ 其他模型... │  │ │
│  │ Service   │ │ Service   │ │  │ Adapter │ │ Adapter │ │  Adapter    │  │ │
│  └───────────┘ └───────────┘ │  └─────────┘ └─────────┘ └─────────────┘  │ │
│                              └───────────────────────────────────────────┘ │
│  功能：核心业务逻辑、模型调用、上下文管理、流式响应处理                         │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                           【数据层 - Data Layer】                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  PostgreSQL │  │   Redis     │  │  消息队列   │  │  对象存储           │ │
│  │  (主数据库) │  │  (缓存/     │  │  (RabbitMQ/ │  │  (MinIO/S3)         │ │
│  │             │  │   会话状态) │  │   Kafka)    │  │  (文件附件)         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                              │
│  功能：数据持久化、缓存加速、异步消息、文件存储                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 架构特点说明

| 层级 | 核心职责 | 关键技术选型 | 扩展性考虑 |
|------|---------|-------------|-----------|
| 表现层 | 用户交互、实时通信 | React + TypeScript | 支持多端适配、PWA |
| 网关层 | 流量管理、安全防护 | Nginx + Kong | 水平扩展、灰度发布 |
| 业务层 | 业务逻辑、模型调度 | Node.js/Go 微服务 | 插件化模型适配器 |
| 数据层 | 数据存储、状态管理 | PostgreSQL + Redis | 读写分离、分片 |

---

## 2. 核心模块分解

### 2.1 模块架构总览

```
┌────────────────────────────────────────────────────────────────┐
│                      AI聊天平台核心模块                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  用户服务    │◄──►│  会话服务    │◄──►│  消息服务    │     │
│  │  UserService │    │ SessionSvc   │    │ MessageSvc   │     │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  密钥保险库  │    │  上下文管理  │    │  模型路由器  │     │
│  │  KeyVault    │◄──►│ ContextMgr   │◄──►│ ModelRouter  │     │
│  └──────────────┘    └──────────────┘    └──────┬───────┘     │
│                                                 │              │
│                      ┌──────────────────────────┼─────┐       │
│                      │      MCP协议适配层       │     │       │
│                      │  ┌────────┐ ┌────────┐ ┌─┴────┐│       │
│                      │  │OpenAI  │ │Claude  │ │Gemini││       │
│                      │  │Adapter │ │Adapter │ │Adapt.││       │
│                      │  └────────┘ └────────┘ └──────┘│       │
│                      └────────────────────────────────┘       │
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  统计分析    │    │  通知服务    │    │  文件服务    │     │
│  │ Analytics    │    │ Notification │    │ FileService  │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 核心服务详细说明

#### 服务1：用户服务 (User Service)

```
职责：用户身份认证、授权、个人配置管理

主要功能：
├── 用户注册/登录（支持OAuth2.0）
├── JWT令牌管理
├── 用户偏好设置
├── 多设备会话管理
└── 用户配额管理

技术要点：
- bcrypt密码加密
- JWT + Refresh Token双令牌
- Redis存储会话状态
```

#### 服务2：会话服务 (Session Service)

```
职责：管理聊天会话的生命周期

主要功能：
├── 创建/删除/归档会话
├── 会话元数据管理
├── 会话分享功能
├── 会话导出（Markdown/JSON）
└── 会话搜索

技术要点：
- 会话标题自动生成（调用AI总结）
- 分页加载历史会话
- 软删除支持恢复
```

#### 服务3：消息服务 (Message Service)

```
职责：处理消息收发、存储、流式传输

主要功能：
├── 消息持久化存储
├── 流式响应(SSE/WebSocket)
├── 消息版本控制（重新生成）
├── 消息反馈（点赞/点踩）
└── 消息引用与分支

技术要点：
- 流式写入数据库
- Token计数与计费
- 消息加密存储选项
```

#### 服务4：上下文管理器 (Context Manager)

```
职责：核心！管理跨模型对话上下文

主要功能：
├── 上下文窗口计算
├── 上下文压缩/摘要
├── 模型切换时上下文转换
├── System Prompt管理
└── 上下文缓存优化

技术要点：
- 针对不同模型的Token计算
- 智能截断策略（保留重要信息）
- 模型切换时的格式适配
```

**上下文转换流程：**
```
用户使用GPT-4对话 ──► 用户切换到Claude ──► 上下文管理器介入
                                              │
                    ┌─────────────────────────┘
                    ▼
            1. 获取完整对话历史
            2. 计算Claude上下文窗口
            3. 智能截断/压缩（如需要）
            4. 转换消息格式（OpenAI→Anthropic）
            5. 注入系统提示："以下是之前的对话记录..."
            6. 发送到Claude API
```

#### 服务5：模型路由器 (Model Router)

```
职责：统一管理多模型调用，基于MCP协议

主要功能：
├── 模型注册与发现
├── 请求路由分发
├── 负载均衡（同模型多密钥）
├── 故障转移
└── 模型能力探测

技术要点：
- 插件化适配器架构
- MCP协议封装
- 重试与熔断机制
```

#### 服务6：密钥保险库 (Key Vault Service)

```
职责：安全管理用户API密钥

主要功能：
├── 密钥加密存储（AES-256）
├── 密钥有效性验证
├── 密钥使用审计
├── 密钥轮换支持
└── 密钥配额告警

技术要点：
- 客户端加密 + 服务端二次加密
- 密钥不落日志
- 内存安全处理
```

#### 服务7：统计分析服务 (Analytics Service)

```
职责：使用量统计、成本分析、数据洞察

主要功能：
├── Token使用量统计
├── 模型使用分布
├── 成本估算与预警
├── 对话质量分析
└── 导出报表

技术要点：
- 时序数据存储（可选TimescaleDB）
- 实时统计 + 批量聚合
- 可视化图表
```

---

## 3. 数据库ER图

### 3.1 ER关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据库ER关系图                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   users     │         │  sessions   │         │  messages   │
    ├─────────────┤   1:N   ├─────────────┤   1:N   ├─────────────┤
    │ id (PK)     │────────►│ id (PK)     │────────►│ id (PK)     │
    │ email       │         │ user_id(FK) │         │ session_id  │
    │ password    │         │ title       │         │ role        │
    │ nickname    │         │ created_at  │         │ content     │
    │ avatar      │         │ updated_at  │         │ model_id    │
    │ status      │         │ archived    │         │ tokens_in   │
    │ created_at  │         │ is_shared   │         │ tokens_out  │
    │ settings    │         │ share_code  │         │ created_at  │
    └──────┬──────┘         └─────────────┘         │ parent_id   │
           │                                         │ version     │
           │                                         └─────────────┘
           │
           │ 1:N
           ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │  api_keys   │         │   models    │         │model_configs│
    ├─────────────┤         ├─────────────┤   1:N   ├─────────────┤
    │ id (PK)     │         │ id (PK)     │────────►│ id (PK)     │
    │ user_id(FK) │         │ provider    │         │ model_id(FK)│
    │ model_id(FK)│◄───────►│ name        │         │ user_id(FK) │
    │ encrypted_  │         │ display_name│         │ temperature │
    │   key       │         │ context_len │         │ max_tokens  │
    │ key_hint    │         │ input_price │         │ top_p       │
    │ is_valid    │         │ output_price│         │ sys_prompt  │
    │ last_used   │         │ capabilities│         │ created_at  │
    │ created_at  │         │ is_active   │         └─────────────┘
    └─────────────┘         │ mcp_config  │
                            └─────────────┘

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │usage_stats  │         │ audit_logs  │         │ feedbacks   │
    ├─────────────┤         ├─────────────┤         ├─────────────┤
    │ id (PK)     │         │ id (PK)     │         │ id (PK)     │
    │ user_id(FK) │         │ user_id(FK) │         │ message_id  │
    │ model_id(FK)│         │ action      │         │ user_id(FK) │
    │ date        │         │ resource    │         │ rating      │
    │ tokens_in   │         │ details     │         │ comment     │
    │ tokens_out  │         │ ip_address  │         │ created_at  │
    │ requests    │         │ user_agent  │         └─────────────┘
    │ cost_usd    │         │ created_at  │
    └─────────────┘         └─────────────┘
```

### 3.2 核心表结构定义

```sql
-- 用户表
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    nickname        VARCHAR(100),
    avatar_url      VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'active',  -- active/suspended/deleted
    settings        JSONB DEFAULT '{}',            -- 用户偏好设置
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at   TIMESTAMP WITH TIME ZONE
);

-- 会话表
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at     TIMESTAMP WITH TIME ZONE,
    is_shared       BOOLEAN DEFAULT FALSE,
    share_code      VARCHAR(20) UNIQUE,
    metadata        JSONB DEFAULT '{}'             -- 额外元数据
);

-- 消息表
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES messages(id),   -- 支持消息分支
    role            VARCHAR(20) NOT NULL,           -- user/assistant/system
    content         TEXT NOT NULL,
    model_id        UUID REFERENCES models(id),
    tokens_input    INTEGER DEFAULT 0,
    tokens_output   INTEGER DEFAULT 0,
    version         INTEGER DEFAULT 1,              -- 重新生成版本号
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'              -- 附加信息
);

-- AI模型表
CREATE TABLE models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        VARCHAR(50) NOT NULL,           -- openai/anthropic/google
    name            VARCHAR(100) NOT NULL,          -- gpt-4/claude-3-opus
    display_name    VARCHAR(100) NOT NULL,
    context_length  INTEGER NOT NULL,               -- 上下文窗口大小
    input_price     DECIMAL(10,6),                  -- 每1K token价格
    output_price    DECIMAL(10,6),
    capabilities    JSONB DEFAULT '[]',             -- vision/function_call等
    is_active       BOOLEAN DEFAULT TRUE,
    mcp_config      JSONB DEFAULT '{}',             -- MCP协议配置
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户API密钥表
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,
    encrypted_key   TEXT NOT NULL,                  -- AES-256加密
    key_hint        VARCHAR(20),                    -- 显示: sk-...xxxx
    is_valid        BOOLEAN DEFAULT TRUE,
    last_validated  TIMESTAMP WITH TIME ZONE,
    last_used_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- 模型个人配置表
CREATE TABLE model_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id        UUID NOT NULL REFERENCES models(id),
    temperature     DECIMAL(3,2) DEFAULT 0.7,
    max_tokens      INTEGER DEFAULT 2048,
    top_p           DECIMAL(3,2) DEFAULT 1.0,
    system_prompt   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_id)
);

-- 使用统计表（按日聚合）
CREATE TABLE usage_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id        UUID NOT NULL REFERENCES models(id),
    stat_date       DATE NOT NULL,
    tokens_input    BIGINT DEFAULT 0,
    tokens_output   BIGINT DEFAULT 0,
    request_count   INTEGER DEFAULT 0,
    cost_usd        DECIMAL(10,4) DEFAULT 0,
    UNIQUE(user_id, model_id, stat_date)
);

-- 审计日志表
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,           -- login/key_update/model_switch
    resource_type   VARCHAR(50),
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 消息反馈表
CREATE TABLE feedbacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          SMALLINT CHECK (rating IN (-1, 1)),  -- -1:差 1:好
    comment         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- 索引优化
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_api_keys_user_provider ON api_keys(user_id, provider);
CREATE INDEX idx_usage_stats_user_date ON usage_stats(user_id, stat_date DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## 4. API设计（RESTful端点列表）

### 4.1 API总览

| 模块 | 基础路径 | 说明 |
|------|---------|------|
| 认证 | `/api/v1/auth` | 用户认证相关 |
| 用户 | `/api/v1/users` | 用户管理 |
| 会话 | `/api/v1/sessions` | 会话管理 |
| 消息 | `/api/v1/messages` | 消息管理 |
| 模型 | `/api/v1/models` | 模型管理 |
| 密钥 | `/api/v1/keys` | API密钥管理 |
| 统计 | `/api/v1/stats` | 统计分析 |
| 聊天 | `/api/v1/chat` | 聊天核心 |

### 4.2 详细端点列表

#### 认证模块 `/api/v1/auth`

| 方法 | 端点 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/register` | 用户注册 | `{email, password, nickname}` |
| POST | `/login` | 用户登录 | `{email, password}` |
| POST | `/logout` | 退出登录 | - |
| POST | `/refresh` | 刷新Token | `{refresh_token}` |
| POST | `/forgot-password` | 忘记密码 | `{email}` |
| POST | `/reset-password` | 重置密码 | `{token, new_password}` |
| GET | `/oauth/:provider` | OAuth登录 | - |
| GET | `/oauth/:provider/callback` | OAuth回调 | - |

#### 用户模块 `/api/v1/users`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/me` | 获取当前用户信息 | - |
| PUT | `/me` | 更新用户信息 | `{nickname, avatar_url}` |
| PUT | `/me/password` | 修改密码 | `{old_password, new_password}` |
| GET | `/me/settings` | 获取用户设置 | - |
| PUT | `/me/settings` | 更新用户设置 | `{theme, language, ...}` |
| DELETE | `/me` | 注销账号 | `{password}` |

#### 会话模块 `/api/v1/sessions`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/` | 获取会话列表 | `?page=1&limit=20&archived=false` |
| POST | `/` | 创建新会话 | `{title?, model_id?}` |
| GET | `/:id` | 获取会话详情 | - |
| PUT | `/:id` | 更新会话 | `{title}` |
| DELETE | `/:id` | 删除会话 | - |
| POST | `/:id/archive` | 归档会话 | - |
| POST | `/:id/unarchive` | 取消归档 | - |
| POST | `/:id/share` | 生成分享链接 | - |
| DELETE | `/:id/share` | 取消分享 | - |
| GET | `/shared/:code` | 获取分享会话 | - |
| GET | `/:id/export` | 导出会话 | `?format=json|markdown` |

#### 消息模块 `/api/v1/messages`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/session/:session_id` | 获取会话消息 | `?before=uuid&limit=50` |
| GET | `/:id` | 获取单条消息 | - |
| DELETE | `/:id` | 删除消息 | - |
| POST | `/:id/regenerate` | 重新生成回复 | `{model_id?}` |
| POST | `/:id/feedback` | 消息反馈 | `{rating, comment?}` |
| GET | `/:id/versions` | 获取消息版本 | - |

#### 模型模块 `/api/v1/models`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/` | 获取可用模型列表 | `?provider=openai` |
| GET | `/:id` | 获取模型详情 | - |
| GET | `/providers` | 获取支持的提供商 | - |
| GET | `/:id/config` | 获取用户模型配置 | - |
| PUT | `/:id/config` | 更新用户模型配置 | `{temperature, max_tokens, ...}` |

#### 密钥模块 `/api/v1/keys`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/` | 获取用户密钥列表 | - |
| POST | `/` | 添加API密钥 | `{provider, api_key}` |
| PUT | `/:id` | 更新API密钥 | `{api_key}` |
| DELETE | `/:id` | 删除API密钥 | - |
| POST | `/:id/validate` | 验证密钥有效性 | - |
| GET | `/:id/usage` | 获取密钥使用情况 | - |

#### 统计模块 `/api/v1/stats`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| GET | `/overview` | 获取使用概览 | `?period=7d|30d|all` |
| GET | `/usage` | 获取使用详情 | `?start_date&end_date&model_id` |
| GET | `/cost` | 获取成本统计 | `?start_date&end_date` |
| GET | `/models` | 模型使用分布 | `?period=30d` |
| GET | `/export` | 导出统计报表 | `?format=csv|json` |

#### 聊天核心模块 `/api/v1/chat`

| 方法 | 端点 | 说明 | 请求体/参数 |
|------|------|------|-------------|
| POST | `/completions` | 发送消息(流式) | `{session_id, content, model_id}` |
| POST | `/completions/sync` | 发送消息(同步) | `{session_id, content, model_id}` |
| POST | `/switch-model` | 切换模型 | `{session_id, model_id}` |
| GET | `/context/:session_id` | 获取上下文信息 | - |
| POST | `/stop` | 停止生成 | `{session_id}` |

### 4.3 WebSocket端点

```
WebSocket: wss://api.example.com/ws/chat

连接参数: ?token=<jwt_token>

客户端发送消息格式:
{
    "type": "message",
    "data": {
        "session_id": "uuid",
        "content": "用户消息",
        "model_id": "uuid"
    }
}

服务端推送格式:
{
    "type": "stream",           // stream/done/error/typing
    "data": {
        "message_id": "uuid",
        "content": "增量内容",
        "model": "gpt-4"
    }
}
```

### 4.4 通用响应格式

```json
// 成功响应
{
    "success": true,
    "data": { ... },
    "meta": {
        "page": 1,
        "limit": 20,
        "total": 100
    }
}

// 错误响应
{
    "success": false,
    "error": {
        "code": "INVALID_API_KEY",
        "message": "API密钥无效或已过期",
        "details": { ... }
    }
}
```

---

## 5. 关键技术决策点及推荐方案

### 5.1 后端语言选型

| 选项 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Node.js (推荐)** | 原生异步、流处理优秀、生态丰富、前后端统一 | CPU密集任务弱 | 流式响应、实时通信 |
| Go | 高性能、并发优秀、编译型 | 生态相对较小、泛型支持有限 | 高吞吐量场景 |
| Python | AI生态丰富、开发快速 | 性能较低、GIL限制 | 快速原型、数据分析 |
| Rust | 极致性能、内存安全 | 学习曲线陡峭、开发慢 | 性能关键组件 |

**推荐方案**: Node.js (TypeScript) + 部分Go微服务

**理由**:
1. 流式响应是核心需求，Node.js原生支持优秀
2. TypeScript提供类型安全，降低维护成本
3. 前后端统一技术栈，团队效率高
4. Go可用于高性能组件（如模型路由器）

### 5.2 数据库选型

| 选项 | 优点 | 缺点 | 推荐用途 |
|------|------|------|----------|
| **PostgreSQL (推荐)** | 功能强大、JSONB支持、扩展性好 | 配置复杂 | 主数据库 |
| MySQL | 成熟稳定、运维简单 | JSON支持较弱 | 传统业务 |
| MongoDB | 灵活Schema、水平扩展 | 事务支持弱、一致性问题 | 日志/非关键数据 |
| SQLite | 零配置、嵌入式 | 不支持并发、不适合生产 | 开发测试 |

**推荐方案**: PostgreSQL + Redis + 可选TimescaleDB

**理由**:
1. JSONB完美支持灵活的消息元数据和模型配置
2. 强事务保证数据一致性
3. Redis处理会话状态和缓存
4. TimescaleDB用于时序统计数据（可选）

### 5.3 前端框架选型

| 选项 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **React (推荐)** | 生态最丰富、社区活跃、灵活 | 需要较多配置 | 复杂SPA |
| Vue | 上手简单、中文文档好 | 大型项目架构需经验 | 中小型项目 |
| Next.js | SSR/SSG、全栈能力 | 学习成本、部署复杂 | SEO需求、全栈 |
| Svelte | 编译时优化、包体小 | 生态较小 | 性能敏感 |

**推荐方案**: React + TypeScript + Vite

**理由**:
1. 丰富的UI组件库（Ant Design / Radix UI）
2. 状态管理方案成熟（Zustand / Redux）
3. 流式渲染支持完善
4. Vite提供极速开发体验

### 5.4 实时通信方案

| 选项 | 优点 | 缺点 | 推荐用途 |
|------|------|------|----------|
| **SSE (推荐)** | 简单、HTTP友好、自动重连 | 单向通信 | 流式响应 |
| WebSocket | 双向实时、低延迟 | 连接管理复杂 | 复杂交互 |
| Long Polling | 兼容性最好 | 效率低、延迟高 | 降级方案 |
| HTTP/2 Push | 多路复用 | 浏览器支持有限 | 未来方案 |

**推荐方案**: SSE为主 + WebSocket备选

**理由**:
1. 流式响应场景SSE完全满足
2. HTTP友好，易于负载均衡和代理
3. 需要双向通信时（打字状态）切换WebSocket

### 5.5 密钥安全方案

| 方案 | 安全级别 | 复杂度 | 推荐 |
|------|---------|--------|------|
| 服务端AES加密 | 中 | 低 | 基础方案 |
| **客户端加密+服务端加密** | 高 | 中 | ✅ 推荐 |
| 硬件安全模块(HSM) | 极高 | 高 | 企业版 |
| 端到端加密 | 极高 | 极高 | 高安全需求 |

**推荐方案**: 双层加密

```
用户输入密钥 
    → 前端使用用户密码派生密钥加密 
    → 传输(HTTPS) 
    → 服务端使用系统密钥二次加密 
    → 存储数据库
```

### 5.6 MCP协议集成方案

| 方面 | 决策 |
|------|------|
| 协议版本 | 遵循MCP规范，支持版本协商 |
| 适配器模式 | 每个AI提供商一个适配器类 |
| 消息格式转换 | 统一内部格式，出口转换 |
| 错误处理 | 统一错误码映射 |
| 扩展机制 | 插件式加载新模型适配器 |

**适配器接口设计**:
```typescript
interface ModelAdapter {
    provider: string;
    models: string[];
    
    // 验证API密钥
    validateKey(key: string): Promise<boolean>;
    
    // 发送消息（流式）
    streamCompletion(
        messages: Message[], 
        options: CompletionOptions
    ): AsyncIterable<StreamChunk>;
    
    // Token计算
    countTokens(messages: Message[]): number;
    
    // 转换消息格式
    convertMessages(messages: InternalMessage[]): ProviderMessage[];
}
```

### 5.7 部署方案对比

| 方案 | 成本 | 运维复杂度 | 扩展性 | 推荐 |
|------|------|-----------|--------|------|
| 单机Docker Compose | 低 | 低 | 差 | 开发/小规模 |
| **Kubernetes** | 中高 | 中高 | 优 | ✅ 生产环境 |
| Serverless (Lambda) | 按量 | 低 | 优 | 低频访问 |
| PaaS (Vercel/Railway) | 中 | 极低 | 中 | 快速上线 |

---

## 6. 开发里程碑（4阶段，每阶段2周）

### 阶段一：基础架构搭建（Week 1-2）

```
目标：完成核心框架搭建，跑通单模型对话流程

┌─────────────────────────────────────────────────────────────────┐
│  Week 1: 后端基础                                               │
├─────────────────────────────────────────────────────────────────┤
│  □ 项目初始化（Node.js + TypeScript + Express/Fastify）         │
│  □ 数据库设计与ORM配置（Prisma/TypeORM）                         │
│  □ 用户认证模块（注册/登录/JWT）                                  │
│  □ 基础API框架搭建                                               │
│  □ Docker开发环境配置                                            │
├─────────────────────────────────────────────────────────────────┤
│  Week 2: 前端基础 + 单模型对话                                   │
├─────────────────────────────────────────────────────────────────┤
│  □ 前端项目初始化（React + TypeScript + Vite）                   │
│  □ UI组件库集成（Tailwind CSS + Radix UI）                       │
│  □ 用户认证页面                                                  │
│  □ 基础聊天界面                                                  │
│  □ 首个模型适配器（OpenAI）                                      │
│  □ SSE流式响应实现                                               │
└─────────────────────────────────────────────────────────────────┘

交付物：
✓ 可运行的开发环境
✓ 用户注册登录功能
✓ 单模型（GPT）基础对话
✓ 流式响应展示
```

### 阶段二：多模型核心功能（Week 3-4）

```
目标：实现多模型切换和上下文共享核心功能

┌─────────────────────────────────────────────────────────────────┐
│  Week 3: 多模型支持                                              │
├─────────────────────────────────────────────────────────────────┤
│  □ Claude适配器开发                                              │
│  □ 模型路由器实现                                                │
│  □ API密钥管理模块（加密存储）                                    │
│  □ 模型配置管理                                                  │
│  □ 密钥管理界面                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Week 4: 上下文管理                                              │
├─────────────────────────────────────────────────────────────────┤
│  □ 上下文管理器核心逻辑                                          │
│  □ Token计数器（多模型）                                         │
│  □ 上下文压缩/截断策略                                           │
│  □ 模型切换逻辑与UI                                              │
│  □ 会话持久化                                                    │
│  □ 消息历史加载                                                  │
└─────────────────────────────────────────────────────────────────┘

交付物：
✓ 支持OpenAI + Claude双模型
✓ 用户可管理自己的API密钥
✓ 对话中可切换模型
✓ 新模型能获取完整历史上下文
✓ 会话持久化存储
```

### 阶段三：完善功能与体验（Week 5-6）

```
目标：完善用户体验，增加统计和管理功能

┌─────────────────────────────────────────────────────────────────┐
│  Week 5: 会话管理与增强功能                                       │
├─────────────────────────────────────────────────────────────────┤
│  □ 会话列表管理（创建/删除/归档）                                 │
│  □ 会话搜索功能                                                  │
│  □ 会话分享功能                                                  │
│  □ 消息重新生成                                                  │
│  □ 消息反馈功能                                                  │
│  □ 导出功能（Markdown/JSON）                                     │
├─────────────────────────────────────────────────────────────────┤
│  Week 6: 统计与用户体验                                          │
├─────────────────────────────────────────────────────────────────┤
│  □ 使用统计服务                                                  │
│  □ 统计仪表盘页面                                                │
│  □ 成本估算功能                                                  │
│  □ 更多模型适配器（Gemini等）                                     │
│  □ 主题切换（深色/浅色）                                          │
│  □ 响应式移动端适配                                              │
└─────────────────────────────────────────────────────────────────┘

交付物：
✓ 完整的会话管理功能
✓ 使用统计仪表盘
✓ 支持3+个AI模型
✓ 良好的移动端体验
✓ 导出和分享功能
```

### 阶段四：安全加固与上线（Week 7-8）

```
目标：安全审计、性能优化、部署上线

┌─────────────────────────────────────────────────────────────────┐
│  Week 7: 安全与测试                                              │
├─────────────────────────────────────────────────────────────────┤
│  □ 安全审计与加固                                                │
│  □ API限流实现                                                   │
│  □ 输入验证与XSS防护                                             │
│  □ 审计日志完善                                                  │
│  □ 单元测试覆盖                                                  │
│  □ 集成测试                                                      │
│  □ E2E测试关键流程                                               │
├─────────────────────────────────────────────────────────────────┤
│  Week 8: 部署与上线                                              │
├─────────────────────────────────────────────────────────────────┤
│  □ 生产环境配置                                                  │
│  □ CI/CD流水线                                                   │
│  □ 监控告警配置（Prometheus + Grafana）                          │
│  □ 文档编写（API文档/用户指南）                                   │
│  □ 性能测试与优化                                                │
│  □ 灰度发布                                                      │
│  □ 正式上线                                                      │
└─────────────────────────────────────────────────────────────────┘

交付物：
✓ 通过安全审计
✓ 测试覆盖率 > 80%
✓ 完整的CI/CD流程
✓ 生产环境部署
✓ 监控告警系统
✓ API文档和用户手册
```

### 里程碑总览

```
Week 1-2        Week 3-4        Week 5-6        Week 7-8
   │               │               │               │
   ▼               ▼               ▼               ▼
┌──────┐       ┌──────┐       ┌──────┐       ┌──────┐
│ MVP  │──────►│ Core │──────►│ Full │──────►│ Prod │
│基础版│       │核心版│       │完整版│       │生产版│
└──────┘       └──────┘       └──────┘       └──────┘
单模型对话      多模型切换      完善功能        安全上线
用户认证        上下文共享      统计分析        性能优化
基础UI         密钥管理        移动适配        文档完善
```

---

## 7. 风险评估与缓解措施

### 7.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| **上下文窗口超限** | 高 | 高 | 实现智能截断、摘要压缩、分段对话 |
| **API调用失败** | 中 | 高 | 重试机制、熔断降级、备用模型切换 |
| **流式响应中断** | 中 | 中 | 断点续传、客户端重连、消息幂等 |
| **Token计算不准** | 中 | 中 | 使用官方tokenizer、留安全余量 |
| **模型API变更** | 中 | 中 | 适配器隔离、版本锁定、监控告警 |

### 7.2 安全风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| **API密钥泄露** | 中 | 极高 | 双层加密、不落日志、最小权限 |
| **注入攻击** | 中 | 高 | 输入验证、参数化查询、CSP |
| **DDoS攻击** | 低 | 高 | CDN防护、限流、弹性扩容 |
| **会话劫持** | 低 | 高 | HTTPS、HttpOnly Cookie、Token刷新 |
| **数据泄露** | 低 | 极高 | 加密存储、访问审计、备份策略 |

### 7.3 业务风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| **模型提供商政策变更** | 中 | 高 | 多模型支持、解耦设计、快速适配 |
| **用户密钥被盗用** | 低 | 中 | 使用审计、异常检测、告警通知 |
| **服务不可用** | 低 | 高 | 高可用架构、灾备方案、SLA监控 |
| **成本超支** | 中 | 中 | 用量监控、预算告警、用户配额 |

### 7.4 风险优先级矩阵

```
影响程度
    ▲
    │
极高│  [密钥泄露]     [数据泄露]
    │        ●            ●
    │
 高 │  [API失败]  [上下文超限]   [DDoS]
    │      ●           ●           ●
    │
 中 │  [Token不准] [流式中断]  [成本超支]
    │      ●           ●           ●
    │
 低 │
    │
    └──────────────────────────────────────►
       低        中        高      可能性

● 重点关注    ○ 持续监控
```

### 7.5 应急预案

```
┌─────────────────────────────────────────────────────────────────┐
│                        应急预案流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. API服务不可用                                               │
│     ├─ 自动切换备用模型                                         │
│     ├─ 展示友好错误提示                                         │
│     ├─ 记录故障日志                                             │
│     └─ 通知运维团队                                             │
│                                                                 │
│  2. 疑似密钥泄露                                                │
│     ├─ 立即禁用可疑密钥                                         │
│     ├─ 通知用户更换密钥                                         │
│     ├─ 审计相关操作记录                                         │
│     └─ 安全团队介入调查                                         │
│                                                                 │
│  3. 数据库故障                                                  │
│     ├─ 自动切换从库                                             │
│     ├─ 启用降级模式（只读）                                     │
│     ├─ 执行数据恢复                                             │
│     └─ 发布故障公告                                             │
│                                                                 │
│  4. 大规模流量涌入                                              │
│     ├─ 自动扩容                                                 │
│     ├─ 启用排队机制                                             │
│     ├─ 临时限制新注册                                           │
│     └─ 评估攻击可能性                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 附录：推荐技术栈总结

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 18 + TypeScript |
| 前端构建 | Vite |
| UI组件 | Tailwind CSS + Radix UI |
| 状态管理 | Zustand |
| 后端框架 | Node.js + Fastify |
| 后端语言 | TypeScript |
| 数据库 | PostgreSQL 15 |
| ORM | Prisma |
| 缓存 | Redis |
| 消息队列 | RabbitMQ (可选) |
| 容器化 | Docker + Docker Compose |
| 编排 | Kubernetes (生产) |
| CI/CD | GitHub Actions |
| 监控 | Prometheus + Grafana |
| 日志 | ELK Stack |
| API文档 | OpenAPI (Swagger) |

---

> 文档版本: 1.0  
> 最后更新: 2026年1月8日  
> 作者: AI架构师
