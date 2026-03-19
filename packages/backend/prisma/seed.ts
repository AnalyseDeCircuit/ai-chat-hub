import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始填充数据库种子数据...')

  // 创建 AI 模型
  const models = [
    // OpenAI 模型
    {
      provider: 'openai',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      contextLength: 128000,
      inputPrice: 0.005,
      outputPrice: 0.015,
      capabilities: {
        supportsVision: true,
        maxImages: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 20971520, // 20MB
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'openai',
      name: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextLength: 128000,
      inputPrice: 0.00015,
      outputPrice: 0.0006,
      capabilities: {
        supportsVision: true,
        maxImages: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 20971520,
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'openai',
      name: 'gpt-4-turbo',
      displayName: 'GPT-4 Turbo',
      contextLength: 128000,
      inputPrice: 0.01,
      outputPrice: 0.03,
      capabilities: {
        supportsVision: true,
        maxImages: 10,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 20971520,
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'openai',
      name: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      contextLength: 16385,
      inputPrice: 0.0005,
      outputPrice: 0.0015,
      capabilities: {
        supportsVision: false,
        supportsFiles: false,
      },
      isActive: true,
    },

    // Anthropic 模型
    {
      provider: 'anthropic',
      name: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet',
      contextLength: 200000,
      inputPrice: 0.003,
      outputPrice: 0.015,
      capabilities: {
        supportsVision: true,
        maxImages: 5,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 10485760, // 10MB
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'anthropic',
      name: 'claude-3-opus-20240229',
      displayName: 'Claude 3 Opus',
      contextLength: 200000,
      inputPrice: 0.015,
      outputPrice: 0.075,
      capabilities: {
        supportsVision: true,
        maxImages: 5,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 10485760,
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'anthropic',
      name: 'claude-3-sonnet-20240229',
      displayName: 'Claude 3 Sonnet',
      contextLength: 200000,
      inputPrice: 0.003,
      outputPrice: 0.015,
      capabilities: {
        supportsVision: true,
        maxImages: 5,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 10485760,
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'anthropic',
      name: 'claude-3-haiku-20240307',
      displayName: 'Claude 3 Haiku',
      contextLength: 200000,
      inputPrice: 0.00025,
      outputPrice: 0.00125,
      capabilities: {
        supportsVision: true,
        maxImages: 5,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 10485760,
        supportsFiles: false,
      },
      isActive: true,
    },

    // Google 模型
    {
      provider: 'google',
      name: 'gemini-1.5-pro',
      displayName: 'Gemini 1.5 Pro',
      contextLength: 1000000,
      inputPrice: 0.00125,
      outputPrice: 0.005,
      capabilities: {
        supportsVision: true,
        maxImages: 16,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 20971520,
        supportsFiles: true,
        supportedFileTypes: ['pdf', 'txt'],
      },
      isActive: true,
    },
    {
      provider: 'google',
      name: 'gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      contextLength: 1000000,
      inputPrice: 0.000075,
      outputPrice: 0.0003,
      capabilities: {
        supportsVision: true,
        maxImages: 16,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxImageSize: 20971520,
        supportsFiles: true,
        supportedFileTypes: ['pdf', 'txt'],
      },
      isActive: true,
    },

    // Moonshot (Kimi) 模型
    {
      provider: 'moonshot',
      name: 'kimi-k2-turbo-preview',
      displayName: 'Kimi K2 Turbo',
      contextLength: 256000,
      inputPrice: 0.002,
      outputPrice: 0.006,
      capabilities: {
        supportsVision: false,
        supportsFiles: false,
      },
      isActive: true,
    },
    {
      provider: 'moonshot',
      name: 'moonshot-v1-128k',
      displayName: 'Moonshot v1 128K',
      contextLength: 128000,
      inputPrice: 0.001,
      outputPrice: 0.003,
      capabilities: {
        supportsVision: false,
        supportsFiles: false,
      },
      isActive: true,
    },
  ]

  for (const model of models) {
    await prisma.model.upsert({
      where: {
        provider_name: {
          provider: model.provider,
          name: model.name,
        },
      },
      update: {
        displayName: model.displayName,
        contextLength: model.contextLength,
        inputPrice: model.inputPrice,
        outputPrice: model.outputPrice,
        capabilities: model.capabilities,
        isActive: model.isActive,
      },
      create: model,
    })
    console.log(`  ✓ ${model.displayName}`)
  }

  console.log('\n✅ 数据库种子数据填充完成！')
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
