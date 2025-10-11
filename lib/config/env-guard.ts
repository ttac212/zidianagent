// pragma: allowlist secret
let validated = false

interface DangerousFlag {
  key: string
  isUnsafe: (value: string | undefined) => boolean
  message: string
}

const DANGEROUS_FLAGS: DangerousFlag[] = [
  {
    key: ['DEV', 'LOGIN', 'CODE'].join('_'),
    isUnsafe: (value) => Boolean(value && value.trim().length > 0),
    message: 'DEV_LOGIN_CODE 应在生产环境中移除'
  },
  {
    key: ['E2E', 'BYPASS', 'AUTH'].join('_'),
    isUnsafe: (value) => value?.toLowerCase() === 'true',
    message: 'E2E_BYPASS_AUTH 不应在生产环境启用'
  },
  {
    key: ['E2E', 'SECRET'].join('_'),
    isUnsafe: (value) => Boolean(value && value.trim().length > 0),
    message: 'E2E_SECRET 为测试用途，应在生产环境中清除'
  }
]

const REQUIRED_VARS: string[] = [
  ['NEXTAUTH', 'SECRET'].join('_'),
  ['LLM', 'API', 'BASE'].join('_'),
  ['LLM', 'API', 'KEY'].join('_')
]

function parseList(value: string | undefined): Set<string> {
  if (!value) return new Set()
  return new Set(
    value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
  )
}

function maskValue(value: string | undefined): string {
  if (!value) return 'NOT_SET'
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}****${value.slice(-2)}`
}

export function validateProductionEnv(logger: Pick<Console, 'error' | 'warn'> = console): void {
  if (validated) return

  validated = true

  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const allowlistedKeys = parseList(process.env.ENV_GUARD_ALLOWLIST)
  const allowlistedRuntimes = parseList(process.env.ENV_GUARD_ALLOW_RUNTIMES)
  const runtimeTag = process.env.ENV_GUARD_RUNTIME
    || process.env.DEPLOY_ENV
    || process.env.VERCEL_ENV
    || process.env.NEXT_RUNTIME
    || 'production'
  const runtimeAllowlisted = allowlistedRuntimes.size > 0 && allowlistedRuntimes.has(runtimeTag)

  const dangerous = DANGEROUS_FLAGS
    .map(({ key, isUnsafe, message }) => ({ key, isUnsafe, message, value: process.env[key] }))
    .filter((item) => item.isUnsafe(item.value))

  const ignoredByKey = dangerous.filter(item => allowlistedKeys.has(item.key))
  const actionable = dangerous.filter(item => !allowlistedKeys.has(item.key))

  if (ignoredByKey.length) {
    const detail = ignoredByKey
      .map(item => `${item.key}=${maskValue(item.value)} (${item.message})`)
      .join('; ')
    logger.warn(`[EnvGuard] 检测到白名单危险变量: ${detail}`)
  }

  if (actionable.length) {
    const details = actionable
      .map((item) => `${item.key}=${maskValue(item.value)} (${item.message})`)
      .join('; ')

    if (runtimeAllowlisted) {
      logger.warn(`[EnvGuard] 当前运行环境 (${runtimeTag}) 允许保留危险变量: ${details}`)
    } else {
      const error = new Error(`生产环境存在危险变量: ${details}`)
      logger.error('[EnvGuard] Deployment blocked by unsafe environment configuration')
      logger.error(error)
      throw error
    }
  }

  const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key]?.trim().length === 0)
  if (missing.length) {
    logger.warn(`[EnvGuard] 生产环境缺少关键变量: ${missing.join(', ')}`)
  }
}
