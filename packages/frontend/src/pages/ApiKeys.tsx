import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, CheckCircle, XCircle, RefreshCw, Key, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { getApiKeys, upsertApiKey, deleteApiKey, validateApiKey } from '@/api/key'
import type { ApiKey, ModelProvider } from '@ai-chat-hub/shared'

const PROVIDERS: {
  value: ModelProvider
  label: string
  placeholder: string
  needsBaseUrl?: boolean
  baseUrlPlaceholder?: string
}[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { value: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  { value: 'google', label: 'Google (Gemini)', placeholder: 'AIza...' },
  { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...' },
  { value: 'zhipu', label: '智谱 AI (GLM)', placeholder: '...' },
  { value: 'moonshot', label: 'Moonshot AI (Kimi)', placeholder: 'sk-...' },
  {
    value: 'azure',
    label: 'Azure OpenAI',
    placeholder: 'your-azure-key',
    needsBaseUrl: true,
    baseUrlPlaceholder: 'https://your-resource.openai.azure.com',
  },
  {
    value: 'custom',
    label: '自定义端点',
    placeholder: 'your-api-key',
    needsBaseUrl: true,
    baseUrlPlaceholder: 'https://api.example.com/v1',
  },
]

export default function ApiKeys() {
  const navigate = useNavigate()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [validating, setValidating] = useState<ModelProvider | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formProvider, setFormProvider] = useState<ModelProvider>('openai')
  const [formKey, setFormKey] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')

  const { toast } = useToast()

  const currentProvider = PROVIDERS.find((p) => p.value === formProvider)

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      setLoading(true)
      const data = await getApiKeys()
      setKeys(data)
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message || '无法加载 API 密钥',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formKey.trim()) {
      toast({
        title: '请输入 API 密钥',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const input: any = {
        provider: formProvider,
        apiKey: formKey,
      }

      if (currentProvider?.needsBaseUrl && formBaseUrl) {
        input.baseUrl = formBaseUrl
      }

      await upsertApiKey(input)

      toast({
        title: '保存成功',
        description: '密钥已加密存储',
      })

      setFormKey('')
      setFormBaseUrl('')
      setShowAddForm(false)
      await loadKeys()
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message || '无法保存 API 密钥',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (provider: ModelProvider) => {
    if (!confirm('确定要删除此 API 密钥吗？')) return

    try {
      await deleteApiKey(provider)
      toast({
        title: '删除成功',
      })
      await loadKeys()
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleValidate = async (provider: ModelProvider) => {
    try {
      setValidating(provider)
      const isValid = await validateApiKey(provider)

      toast({
        title: isValid ? '密钥有效' : '密钥无效',
        description: isValid ? '该 API 密钥可以正常使用' : '请检查密钥是否正确',
        variant: isValid ? 'default' : 'destructive',
      })

      await loadKeys()
    } catch (error: any) {
      toast({
        title: '验证失败',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setValidating(null)
    }
  }

  const getProviderLabel = (provider: ModelProvider) => {
    return PROVIDERS.find((p) => p.value === provider)?.label || provider
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Header with back button */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">API 密钥管理</h1>
            <p className="text-muted-foreground">
              管理您的 AI 模型 API 密钥。密钥将使用 AES-256 加密存储。
            </p>
          </div>
        </div>
      </div>

      {/* 已保存的密钥列表 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>已保存的密钥</CardTitle>
          <CardDescription>您已配置的 API 密钥</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>还没有配置任何 API 密钥</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{getProviderLabel(key.provider)}</h3>
                      {key.isValid ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{key.keyHint}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {key.lastValidated && (
                        <span>最后验证: {new Date(key.lastValidated).toLocaleString()}</span>
                      )}
                      {key.lastUsedAt && (
                        <span className="ml-3">
                          最后使用: {new Date(key.lastUsedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleValidate(key.provider)}
                      disabled={validating === key.provider}
                    >
                      {validating === key.provider ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(key.provider)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加密钥表单 */}
      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle>添加 API 密钥</CardTitle>
            <CardDescription>添加或更新您的 AI 模型 API 密钥</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="provider">供应商</Label>
                <Select value={formProvider} onValueChange={(v) => setFormProvider(v as ModelProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentProvider?.needsBaseUrl && (
                <div>
                  <Label htmlFor="baseUrl">API 端点 URL</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    placeholder={currentProvider.baseUrlPlaceholder}
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formProvider === 'azure'
                      ? '输入您的 Azure OpenAI 资源端点'
                      : '输入自定义的 API 端点 URL'}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="apiKey">API 密钥</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={currentProvider?.placeholder}
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  密钥将加密存储，仅用于调用 AI 模型 API
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? '保存中...' : '保存密钥'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormKey('')
                    setFormBaseUrl('')
                  }}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowAddForm(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          添加 API 密钥
        </Button>
      )}

      {/* 帮助信息 */}
      <Card className="mt-6 bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">如何获取 API 密钥？</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            <strong>OpenAI:</strong>{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://platform.openai.com/api-keys
            </a>
          </div>
          <div>
            <strong>Anthropic:</strong>{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://console.anthropic.com/settings/keys
            </a>
          </div>
          <div>
            <strong>Google:</strong>{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://aistudio.google.com/app/apikey
            </a>
          </div>
          <div>
            <strong>DeepSeek:</strong>{' '}
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://platform.deepseek.com/api_keys
            </a>
          </div>
          <div>
            <strong>智谱 AI:</strong>{' '}
            <a
              href="https://open.bigmodel.cn/usercenter/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://open.bigmodel.cn/usercenter/apikeys
            </a>
          </div>
          <div>
            <strong>Moonshot AI:</strong>{' '}
            <a
              href="https://platform.moonshot.cn/console/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://platform.moonshot.cn/console/api-keys
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
