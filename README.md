# AI-Chat-Hub 🤖

<div align="center">

**多模型协作 AI 聊天平台**

一个功能强大的现代化 AI 聊天平台，支持多个主流大语言模型无缝协作

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-black.svg)](https://fastify.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[English](README_EN.md) | 简体中文

</div>

---

## ✨ 核心特性

### 🔄 多模型协作
- **8+ AI 模型支持**: OpenAI (GPT-4, GPT-3.5)、Claude (Anthropic)、Gemini (Google)、DeepSeek、Zhipu AI (智谱清言)、Moonshot AI (月之暗面)、Azure OpenAI、自定义端点
- **对话中切换**: 随时切换模型，自动传递完整上下文
- **智能上下文管理**: 自动 Token 计数和智能截断，确保上下文不丢失

### 🔐 安全与隐私
- **私有化部署**: 所有数据存储在您的服务器，完全掌控
- **API 密钥加密**: AES-256 双层加密，密钥只存在您的环境中
- **用户隔离**: 多用户支持，数据完全隔离

### 💬 聊天体验
- **流式响应**: Server-Sent Events (SSE) 实时流式输出
- **Markdown 支持**: 完整的 Markdown 渲染，代码高亮显示
- **会话管理**: 创建、搜索、归档、分享会话
- **消息操作**: 重新生成、编辑、复制、反馈

### 📊 使用分析
- **Token 统计**: 实时统计输入/输出 Token 用量
- **成本估算**: 按模型自动计算使用成本
- **可视化面板**: 使用趋势、模型分布一目了然

### 🎨 用户体验
- **6 种精美主题**: Light、Dark、Violet、Ocean、Green、Sepia
- **响应式设计**: 完美适配桌面、平板、手机
- **毛玻璃效果**: 现代化 UI 设计，细节打磨到位
- **快捷操作**: 键盘快捷键，高效操作

## 🛠️ 技术栈

### 前端技术
- **核心框架**: React 18 + TypeScript 5
- **构建工具**: Vite 5
- **UI 框架**: Tailwind CSS 3 + shadcn/ui (Radix UI)
- **状态管理**: Zustand
- **路由管理**: React Router v6
- **HTTP 客户端**: Axios + TanStack Query
- **Markdown 渲染**: react-markdown + Prism
- **主题管理**: CSS Variables + Context API

### 后端技术
- **核心框架**: Fastify 4 + TypeScript
- **数据库**: PostgreSQL 16
- **ORM**: Prisma 5
- **缓存**: Redis 7
- **认证**: JWT (access token + refresh token)
- **加密**: crypto (AES-256-GCM)
- **日志**: Pino
- **校验**: Zod

### 开发工具
- **包管理**: pnpm + Turborepo (Monorepo)
- **代码规范**: ESLint + Prettier
- **容器化**: Docker + Docker Compose
- **版本控制**: Git + Conventional Commits

## 📦 项目结构

```
ai-chat-hub/
├── packages/
│   ├── shared/                 # 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/         # TypeScript 类型定义
│   │   │   ├── constants/     # 常量配置（模型列表、限制等）
│   │   │   └── utils/         # 工具函数
│   │   └── package.json
│   │
│   ├── backend/               # 后端服务
│   │   ├── src/
│   │   │   ├── adapters/     # AI 模型适配器
│   │   │   ├── modules/      # 业务模块（auth/chat/session/key）
│   │   │   ├── services/     # 核心服务（加密/上下文/统计）
│   │   │   ├── plugins/      # Fastify 插件
│   │   │   ├── middleware/   # 中间件（认证/限流）
│   │   │   └── config/       # 配置管理
│   │   ├── prisma/           # 数据库 Schema 和迁移
│   │   └── package.json
│   │
│   └── frontend/              # 前端应用
│       ├── src/
│       │   ├── pages/        # 页面组件
│       │   ├── components/   # 可复用组件
│       │   ├── stores/       # Zustand 状态管理
│       │   ├── api/          # API 客户端
│       │   └── styles/       # 全局样式和主题
│       └── package.json
│
├── docker-compose.yml         # Docker 服务编排
├── pnpm-workspace.yaml        # pnpm Monorepo 配置
├── turbo.json                 # Turborepo 构建配置
├── DEPLOYMENT.md              # 详细部署文档
├── SECURITY.md                # 安全配置指南
└── TIMELINE.md                # 开发时间轴
```

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Docker Desktop**: 最新版本（用于 PostgreSQL 和 Redis）

### 一键启动（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/AnalyseDeCircuit/ai-chat-hub.git
cd ai-chat-hub

# 2. 安装依赖
npx pnpm install

# 3. 启动数据库服务
docker-compose up -d

# 4. 初始化数据库
cd packages/backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 5. 配置环境变量（必须！）
cp .env.example .env
# 编辑 .env，生成安全密钥：
# openssl rand -base64 32

# 6. 启动后端（新终端）
npm run dev

# 7. 启动前端（新终端）
cd ../frontend
npm run dev
```

### 访问应用

🌐 **前端**: http://localhost:5174 (或 5173)  
🔌 **后端 API**: http://localhost:3000/api/v1  
💚 **健康检查**: http://localhost:3000/health

### 首次使用

1. **注册账号**: 访问前端，点击"注册"创建新账号
2. **添加 API 密钥**: 登录后，进入"API 密钥管理"页面，添加至少一个 AI 模型的密钥
   - OpenAI: https://platform.openai.com/api-keys
   - Claude: https://console.anthropic.com/
   - Gemini: https://makersuite.google.com/app/apikey
   - DeepSeek: https://platform.deepseek.com/
3. **开始对话**: 返回聊天页面，选择模型，开始体验！

> 💡 详细部署和故障排查指南请查看 [DEPLOYMENT.md](DEPLOYMENT.md)

## 📝 开发命令

```bash
# 🚀 开发模式（Monorepo 所有包）
pnpm dev

# 🏗️ 构建项目
pnpm build

# 🧪 运行测试
pnpm test

# ✅ 代码检查
pnpm lint

# 🎨 格式化代码
pnpm format

# 📦 清理依赖
pnpm clean
```

### 数据库操作

```bash
cd packages/backend

# 生成 Prisma Client
npx prisma generate

# 创建迁移
npx prisma migrate dev --name <migration-name>

# 推送 Schema（不创建迁移）
npx prisma db push

# 打开 Prisma Studio（可视化管理）
npx prisma studio

# 重置数据库（危险！）
npx prisma migrate reset
```

### Docker 操作

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```

## 🔧 配置说明

### 支持的 AI 模型

| 提供商 | 模型示例 | 获取密钥 |
|--------|---------|---------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-3.5 | [API Keys](https://platform.openai.com/api-keys) |
| Anthropic | Claude 3 Opus, Sonnet, Haiku | [Console](https://console.anthropic.com/) |
| Google | Gemini Pro, Gemini Pro Vision | [AI Studio](https://makersuite.google.com/app/apikey) |
| DeepSeek | DeepSeek Chat, DeepSeek Coder | [Platform](https://platform.deepseek.com/) |
| Zhipu AI | GLM-4, GLM-3-Turbo | [开放平台](https://open.bigmodel.cn/) |
| Moonshot | Moonshot-v1, Kimi K2 | [控制台](https://platform.moonshot.cn/) |
| Azure OpenAI | 自定义部署 | [Azure Portal](https://portal.azure.com/) |
| 自定义 | 任何 OpenAI 兼容端点 | - |

### 环境变量说明

**后端** (`packages/backend/.env`):
```bash
# 数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_chat_hub

# Redis
REDIS_URL=redis://localhost:6379

# JWT 密钥（必须修改！）
JWT_SECRET=<至少 32 字符>
REFRESH_TOKEN_SECRET=<至少 32 字符>

# 加密密钥（必须修改！必须是 32 字节）
ENCRYPTION_KEY=<openssl rand -base64 32>

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

# 其他
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

**前端** (`packages/frontend/.env`):
```bash
VITE_API_URL=http://localhost:3000/api/v1
```

## 🤝 贡献指南

欢迎贡献代码、提出问题或建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### Commit 规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新功能
fix: 修复 Bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具链
```

## 🐛 问题反馈

如遇到问题，请：
1. 查看 [DEPLOYMENT.md](DEPLOYMENT.md) 故障排查部分
2. 搜索 [Issues](https://github.com/your-username/ai-chat-hub/issues) 是否已有相关问题
3. 提交新的 Issue，附上详细的错误信息和环境信息

## 🗺️ 开发路线图

- [x] 基础聊天功能
- [x] 多模型支持和切换
- [x] API 密钥管理
- [x] 会话管理和导出
- [x] 使用统计
- [x] 多主题支持
- [ ] 图片理解（Vision 模型）
- [ ] 文件上传和解析
- [ ] 插件系统
- [ ] 移动端 App
- [ ] 语音对话
- [ ] 团队协作功能

## 📄 许可证

本项目基于 [CC-BY-NC 4.0](LICENSE) 开源。

**许可证说明**:
- ✅ 可以自由使用和修改
- ✅ 必须署名
- ✅ 仅限非商业用途
- ❌ 禁止商业使用

详见 [LICENSE](LICENSE) 文件或访问 [Creative Commons](https://creativecommons.org/licenses/by-nc/4.0/)

## 🙏 致谢

- [Fastify](https://fastify.io/) - 高性能 Node.js 框架
- [Prisma](https://www.prisma.io/) - 现代化 ORM
- [shadcn/ui](https://ui.shadcn.com/) - 精美的 UI 组件
- [Tailwind CSS](https://tailwindcss.com/) - 实用的 CSS 框架

---

<div align="center">

**⭐ 如果觉得有帮助，请给个 Star！⭐**

Made with ❤️ by AI-Chat-Hub Team

</div>
