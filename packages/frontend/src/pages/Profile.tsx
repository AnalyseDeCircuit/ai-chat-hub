import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Save, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/api/user'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user: authUser, setUser } = useAuthStore()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  
  // 用户信息表单
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  
  // 修改密码表单
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 加载用户信息
  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      setLoading(true)
      const user = await userApi.getMe()
      setNickname(user.nickname || '')
      setAvatarUrl(user.avatarUrl || '')
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message || '无法加载用户信息',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 保存用户信息
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      const updatedUser = await userApi.updateMe({
        nickname: nickname || undefined,
        avatarUrl: avatarUrl || undefined,
      })
      
      // 更新 auth store 中的用户信息
      if (authUser) {
        setUser({
          ...authUser,
          nickname: updatedUser.nickname,
          avatarUrl: updatedUser.avatarUrl,
        })
      }
      
      toast({
        title: '保存成功',
        description: '个人信息已更新',
      })
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message || '无法保存用户信息',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // 修改密码
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      toast({
        title: '密码不匹配',
        description: '两次输入的新密码不一致',
        variant: 'destructive',
      })
      return
    }
    
    if (newPassword.length < 6) {
      toast({
        title: '密码太短',
        description: '密码至少需要 6 个字符',
        variant: 'destructive',
      })
      return
    }
    
    try {
      setChangingPassword(true)
      await userApi.changePassword(oldPassword, newPassword)
      
      toast({
        title: '密码已修改',
        description: '请使用新密码重新登录',
      })
      
      // 清空表单
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast({
        title: '修改失败',
        description: error.response?.data?.error?.message || '密码修改失败',
        variant: 'destructive',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">个人信息</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              基本信息
            </CardTitle>
            <CardDescription>
              管理您的个人资料信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  邮箱地址
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={authUser?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  邮箱地址不可修改
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">昵称</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入您的昵称"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">头像 URL</Label>
                <Input
                  id="avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
                {avatarUrl && (
                  <div className="mt-2">
                    <img
                      src={avatarUrl}
                      alt="头像预览"
                      className="w-16 h-16 rounded-full object-cover border border-border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  保存修改
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              修改密码
            </CardTitle>
            <CardDescription>
              定期更换密码可以提高账号安全性
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">当前密码</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="输入当前密码"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少 6 位）"
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
                >
                  {changingPassword ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  修改密码
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 账号信息 */}
        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">账号状态</span>
              <span className="text-green-500 font-medium">正常</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">注册时间</span>
              <span>{authUser?.createdAt ? new Date(authUser.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">最后登录</span>
              <span>{authUser?.lastLoginAt ? new Date(authUser.lastLoginAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* 危险操作 */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              危险操作
            </CardTitle>
            <CardDescription>
              以下操作不可逆，请谨慎操作
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">注销账号</p>
                <p className="text-sm text-muted-foreground">
                  永久删除您的账号和所有数据
                </p>
              </div>
              <Button variant="destructive" disabled>
                注销账号
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
