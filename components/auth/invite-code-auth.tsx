"use client"

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, User, CheckCircle, LogIn, UserPlus } from 'lucide-react'
import { RouteTransitionOverlay } from '@/components/ui/route-transition-overlay'

interface InviteCodeVerification {
  id: string
  code: string
  description: string | null
  defaultRole: string
  monthlyTokenLimit: number
  remainingUses: number
  expiresAt: string | null
}

export function InviteCodeAuth() {
  // 主模式切换：登录 or 注册
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  
  // 注册流程状态
  const [step, setStep] = useState<'verify' | 'register'>('verify')
  const [inviteCode, setInviteCode] = useState('')
  const [verifiedInvite, setVerifiedInvite] = useState<InviteCodeVerification | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  
  // 通用状态
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()

  // 登录信息
  const [loginEmail, setLoginEmail] = useState('')
  
  // 注册信息
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')

  // 已注册用户登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!loginEmail.trim()) {
      setError('请输入邮箱地址')
      return
    }

    setError(null)
    setIsLoading(true)
    let startedRedirect = false

    try {
      // 安全检查：确保开发登录码已正确配置
      const devLoginCode = process.env.NEXT_PUBLIC_DEV_LOGIN_CODE
      if (!devLoginCode) {
        setError('开发环境登录码未配置，请联系管理员')
        return
      }

      const result = await signIn('credentials', {
        email: loginEmail.trim(),
        code: devLoginCode,
        redirect: false,
      })

      if (result?.error) {
        setError('登录失败：' + result.error)
      } else {
        // 登录成功，使用 App Router 导航并显示过渡遮罩
        setRedirecting(true)
        startedRedirect = true
        // 确保会话状态即时可见（如遇延迟问题可移除此调用）
        try { router.refresh() } catch {}
        router.replace('/workspace')
        return
      }
    } catch (err: any) {
      setError('登录失败：' + (err.message || '网络错误'))
    } finally {
      if (!startedRedirect) setIsLoading(false)
    }
  }

  // 验证邀请码
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inviteCode.trim()) {
      setVerifyError('请输入邀请码')
      return
    }
    
    setIsVerifying(true)
    setVerifyError(null)
    
    try {
      const response = await fetch('/api/invite-codes/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: inviteCode.trim().toUpperCase() })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setVerifiedInvite(data.data)
        setStep('register')
      } else {
        setVerifyError(data.error || '邀请码验证失败')
      }
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      setVerifyError('网络错误，请重试')
    } finally {
      setIsVerifying(false)
    }
  }

  // 注册用户
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      // 先调用后端注册接口
      const res = await fetch('/api/invite-codes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          email: email.trim(),
          username: username.trim() || undefined,
          displayName: displayName.trim() || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || '注册失败')
        return
      }

      // 注册成功后，使用临时 Credentials 自动登录（开发期）
      const login = await signIn('credentials', {
        email: email.trim(),
        code: process.env.NEXT_PUBLIC_DEV_LOGIN_CODE || 'dev-123456',
        redirect: false,
      })
      if (login?.error) {
        setError(login.error)
        return
      }

      // 跳转工作台（使用 App Router 导航）
      setRedirecting(true)
      let _startedRedirect = true
      // 确保会话状态即时可见（如遇延迟问题可移除此调用）
      try { router.refresh() } catch {}
      router.replace('/workspace')
      return
    } catch (err: any) {
      setError(err?.message || '注册失败')
    } finally {
      // 如果没有开始跳转，才恢复按钮状态
      if (!redirecting) setIsLoading(false)
    }
  }

  // 返回验证步骤
  const handleBackToVerify = () => {
    setStep('verify')
    setVerifiedInvite(null)
    setVerifyError(null)
  }

  // 切换认证模式时清理状态
  const handleModeChange = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    setError(null)
    setVerifyError(null)
    setLoginEmail('')
    setEmail('')
    setUsername('')
    setDisplayName('')
    setInviteCode('')
    setVerifiedInvite(null)
    setStep('verify')
  }

  // 渲染登录表单
  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">邮箱地址</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="请输入您的注册邮箱"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isLoading || !loginEmail.trim()}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            登录中...
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            登录
          </>
        )}
      </Button>

      <div className="text-center text-xs text-muted-foreground">
        使用您注册时的邮箱地址登录
      </div>
    </form>
  )

  // 渲染注册邀请码验证表单
  const renderInviteForm = () => (
    <form onSubmit={handleVerifyCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-code">邀请码</Label>
        <Input
          id="invite-code"
          type="text"
          placeholder="例如：ZHIDIAN5DLX01"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="text-center font-mono tracking-wider"
          maxLength={20}
          disabled={isVerifying}
        />
      </div>

      {verifyError && (
        <Alert variant="destructive">
          <AlertDescription>{verifyError}</AlertDescription>
        </Alert>
      )}

      {/* 开发环境显示测试邀请码 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
            开发测试用邀请码：
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 font-mono">
            ZHIDIAN5DLX01
          </div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
            onClick={() => setInviteCode('ZHIDIAN5DLX01')}
          >
            点击自动填入
          </button>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isVerifying || !inviteCode.trim()}>
        {isVerifying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            验证中...
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            验证邀请码
          </>
        )}
      </Button>

      <div className="text-center text-xs text-muted-foreground">
        还没有邀请码？请联系我们获取
      </div>
    </form>
  )

  // 渲染注册信息填写表单
  const renderRegisterForm = () => (
    <>
      {verifiedInvite && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center mb-2">
            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">邀请码验证成功</span>
          </div>
          <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
            <p>邀请码: <span className="font-mono">{verifiedInvite.code}</span></p>
            <p>月度配额: {verifiedInvite.monthlyTokenLimit.toLocaleString()} tokens</p>
            {verifiedInvite.description && (
              <p>说明: {verifiedInvite.description}</p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱 *</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="name@example.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            disabled={isLoading} 
            autoComplete="email" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">用户名（可选）</Label>
          <Input 
            id="username" 
            type="text" 
            placeholder="不超过20个字符" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            disabled={isLoading} 
            autoComplete="username" 
            maxLength={20} 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">显示名称（可选）</Label>
          <Input 
            id="displayName" 
            type="text" 
            placeholder="用于展示的昵称" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            disabled={isLoading} 
            maxLength={50} 
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleBackToVerify}
            disabled={isLoading}
          >
            返回
          </Button>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                创建账户
              </>
            )}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          继续即表示你同意我们的
          <Link href="/terms" className="mx-1 underline underline-offset-4 hover:text-foreground" prefetch={false}>
            服务条款
          </Link>
          与
          <Link href="/privacy" className="ml-1 underline underline-offset-4 hover:text-foreground" prefetch={false}>
            隐私政策
          </Link>
        </p>
      </form>
    </>
  )

  return (
    <>
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl text-center">支点有星辰</CardTitle>
          <CardDescription className="text-center">
            {authMode === 'login' ? '欢迎回来，请登录您的账户' : '使用邀请码创建新账户'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={authMode} onValueChange={(value) => handleModeChange(value as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">
                <LogIn className="w-4 h-4 mr-1" />
                登录
              </TabsTrigger>
              <TabsTrigger value="register">
                <UserPlus className="w-4 h-4 mr-1" />
                注册
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              {renderLoginForm()}
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              {authMode === 'register' && step === 'verify' ? renderInviteForm() : renderRegisterForm()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {redirecting && <RouteTransitionOverlay text="正在进入工作区..." />}
    </>
  )
}
