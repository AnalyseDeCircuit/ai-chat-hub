# AI-Chat-Hub 🤖

<div align="center">

**Multi-Model AI Chat Platform**

A powerful modern AI chat platform supporting seamless collaboration among multiple mainstream large language models

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-black.svg)](https://fastify.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

English | [简体中文](README.md)

</div>

---

## ✨ Core Features

### 🔄 Multi-Model Collaboration
- **8+ AI Models**: OpenAI (GPT-4, GPT-3.5), Claude (Anthropic), Gemini (Google), DeepSeek, Zhipu AI, Moonshot AI, Azure OpenAI, Custom Endpoints
- **Seamless Model Switching**: Switch models anytime in conversations, automatically passing full context
- **Intelligent Context Management**: Auto token counting and smart truncation to preserve context

### 🔐 Security & Privacy
- **Self-Hosted**: All data stored on your server, full control
- **API Key Encryption**: AES-256 dual-layer encryption, keys only in your environment
- **User Isolation**: Multi-user support with complete data isolation

### 💬 Chat Experience
- **Streaming Responses**: Server-Sent Events (SSE) for real-time streaming output
- **Markdown Support**: Full Markdown rendering with code syntax highlighting
- **Session Management**: Create, search, archive, and share conversations
- **Message Operations**: Regenerate, edit, copy, and provide feedback

### 📊 Usage Analytics
- **Token Statistics**: Real-time tracking of input/output token usage
- **Cost Estimation**: Automatic cost calculation by model
- **Visualization Dashboard**: Usage trends and model distribution at a glance

### 🎨 User Experience
- **6 Beautiful Themes**: Light, Dark, Violet, Ocean, Green, Sepia
- **Responsive Design**: Perfect adaptation for desktop, tablet, and mobile
- **Glassmorphism Effects**: Modern UI design with polished details
- **Keyboard Shortcuts**: Efficient operations with shortcuts

## 🛠️ Tech Stack

### Frontend
- **Core**: React 18 + TypeScript 5
- **Build Tool**: Vite 5
- **UI Framework**: Tailwind CSS 3 + shadcn/ui (Radix UI)
- **State Management**: Zustand
- **Router**: React Router v6
- **HTTP Client**: Axios + TanStack Query
- **Markdown**: react-markdown + Prism
- **Theme**: CSS Variables + Context API

### Backend
- **Core**: Fastify 4 + TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5
- **Cache**: Redis 7
- **Auth**: JWT (access + refresh tokens)
- **Encryption**: crypto (AES-256-GCM)
- **Logging**: Pino
- **Validation**: Zod

### DevOps
- **Package Manager**: pnpm + Turborepo (Monorepo)
- **Code Standards**: ESLint + Prettier
- **Containerization**: Docker + Docker Compose
- **Version Control**: Git + Conventional Commits

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Docker Desktop**: Latest version (for PostgreSQL and Redis)

### One-Click Setup

```bash
# 1. Clone repository
git clone https://github.com/your-username/ai-chat-hub.git
cd ai-chat-hub

# 2. Install dependencies
npx pnpm install

# 3. Start database services
docker-compose up -d

# 4. Initialize database
cd packages/backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 5. Configure environment variables (Required!)
cp .env.example .env
# Edit .env and generate secure keys:
# openssl rand -base64 32

# 6. Start backend (new terminal)
npm run dev

# 7. Start frontend (new terminal)
cd ../frontend
npm run dev
```

### Access Application

🌐 **Frontend**: http://localhost:5174 (or 5173)  
🔌 **Backend API**: http://localhost:3000/api/v1  
💚 **Health Check**: http://localhost:3000/health

### First-Time Usage

1. **Register Account**: Visit frontend, click "Register" to create account
2. **Add API Key**: After login, go to "API Key Management" and add at least one AI model key
   - OpenAI: https://platform.openai.com/api-keys
   - Claude: https://console.anthropic.com/
   - Gemini: https://makersuite.google.com/app/apikey
   - DeepSeek: https://platform.deepseek.com/
3. **Start Chatting**: Return to chat page, select model, and start!

> 💡 For detailed deployment and troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md)

## 📝 Development Commands

```bash
# 🚀 Development mode (all packages)
pnpm dev

# 🏗️ Build project
pnpm build

# 🧪 Run tests
pnpm test

# ✅ Code linting
pnpm lint

# 🎨 Code formatting
pnpm format

# 📦 Clean dependencies
pnpm clean
```

## 🔧 Supported AI Models

| Provider | Example Models | Get API Key |
|----------|----------------|-------------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-3.5 | [API Keys](https://platform.openai.com/api-keys) |
| Anthropic | Claude 3 Opus, Sonnet, Haiku | [Console](https://console.anthropic.com/) |
| Google | Gemini Pro, Gemini Pro Vision | [AI Studio](https://makersuite.google.com/app/apikey) |
| DeepSeek | DeepSeek Chat, DeepSeek Coder | [Platform](https://platform.deepseek.com/) |
| Zhipu AI | GLM-4, GLM-3-Turbo | [Platform](https://open.bigmodel.cn/) |
| Moonshot | Moonshot-v1, Kimi K2 | [Console](https://platform.moonshot.cn/) |
| Azure OpenAI | Custom Deployment | [Azure Portal](https://portal.azure.com/) |
| Custom | Any OpenAI-compatible endpoint | - |

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

1. Fork this repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: New feature
fix: Bug fix
docs: Documentation update
style: Code formatting
refactor: Code refactoring
perf: Performance optimization
test: Testing
chore: Build/toolchain
```

## 🗺️ Roadmap

- [x] Basic chat functionality
- [x] Multi-model support and switching
- [x] API key management
- [x] Session management and export
- [x] Usage statistics
- [x] Multiple themes
- [ ] Image understanding (Vision models)
- [ ] File upload and parsing
- [ ] Plugin system
- [ ] Mobile app
- [ ] Voice conversation
- [ ] Team collaboration

## 📄 License

This project is licensed under [CC-BY-NC 4.0](LICENSE) (Creative Commons Attribution-NonCommercial 4.0 International).

**License Terms**:
- ✅ Free to use and modify
- ✅ Must provide attribution
- ✅ Non-commercial use only
- ❌ Commercial use prohibited

For details, see [LICENSE](LICENSE) or visit [Creative Commons](https://creativecommons.org/licenses/by-nc/4.0/)

## 🙏 Acknowledgments

- [Fastify](https://fastify.io/) - High-performance Node.js framework
- [Prisma](https://www.prisma.io/) - Modern ORM
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

<div align="center">

**⭐ Star us if you find this helpful! ⭐**

Made with ❤️ by AI-Chat-Hub Team

</div>
