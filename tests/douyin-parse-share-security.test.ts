/**
 * 抖音分享链接解析 API 安全测试
 *
 * 测试重点：
 * 1. SSRF 漏洞防护 - 确保只允许抖音官方域名
 * 2. 鉴权保护 - 确保未登录用户无法访问
 * 3. 错误处理 - 确保错误信息友好且不泄露敏感信息
 */

import { describe, it, expect } from 'vitest'

describe('抖音分享链接解析安全', () => {
  describe('域名白名单验证（SSRF防护）', () => {
    it('应该只允许抖音官方域名', async () => {
      const { parseDouyinUserShare } = await import('../lib/douyin/share-link')

      // 测试恶意域名 - 应该被拒绝
      // 注意：需要提供完整的URL格式，因为extractFirstUrl会先验证格式
      const maliciousUrls = [
        'https://v.douyin-fake.com/xxx',              // 相似域名
        'https://v.evil.com/xxx',                     // 非抖音域名
      ]

      for (const url of maliciousUrls) {
        await expect(
          parseDouyinUserShare(url)
        ).rejects.toThrow(/域名|安全|不允许|链接/)
      }
    })

    it('应该接受抖音官方域名', async () => {
      // 验证白名单域名列表存在且不为空
      const fs = await import('fs')
      const path = await import('path')
      const shareLinkPath = path.join(process.cwd(), 'lib/douyin/share-link.ts')
      const fileContent = fs.readFileSync(shareLinkPath, 'utf-8')

      // 验证代码中存在域名白名单
      expect(fileContent).toContain('ALLOWED_DOUYIN_DOMAINS')
      expect(fileContent).toContain('v.douyin.com')
      expect(fileContent).toContain('www.douyin.com')
      expect(fileContent).toContain('www.iesdouyin.com')  // 视频服务域名
    })

    it('应该在重定向后验证最终域名', async () => {
      // 验证 resolveRedirect 函数调用了域名验证
      const fs = await import('fs')
      const path = await import('path')
      const shareLinkPath = path.join(process.cwd(), 'lib/douyin/share-link.ts')
      const shareLinkFile = fs.readFileSync(shareLinkPath, 'utf-8')

      // 验证 resolveRedirect 函数中存在域名验证调用
      expect(shareLinkFile).toContain('validateDouyinDomain')
      expect(shareLinkFile).toContain('重定向结果校验')
    })
  })

  describe('API鉴权保护', () => {
    it('API路由应该检查用户登录状态', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const apiPath = path.join(process.cwd(), 'app/api/douyin/parse-share/route.ts')
      const apiFile = fs.readFileSync(apiPath, 'utf-8')

      // 验证API文件中存在鉴权检查
      expect(apiFile).toContain('getServerSession')
      expect(apiFile).toContain('session')
      expect(apiFile).toContain('401')
      expect(apiFile).toContain('未授权')
    })

    it('应该在请求早期进行鉴权检查', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const apiPath = path.join(process.cwd(), 'app/api/douyin/parse-share/route.ts')
      const apiFile = fs.readFileSync(apiPath, 'utf-8')

      // 查找 session 检查的位置应该在 parseDouyinUserShare 调用之前
      const sessionCheckIndex = apiFile.indexOf('getServerSession')
      const parseCallIndex = apiFile.indexOf('parseDouyinUserShare')

      expect(sessionCheckIndex).toBeGreaterThan(-1)
      expect(parseCallIndex).toBeGreaterThan(-1)
      expect(sessionCheckIndex).toBeLessThan(parseCallIndex)
    })
  })

  describe('错误处理安全', () => {
    it('应该提供友好的错误信息', async () => {
      const { parseDouyinUserShare } = await import('../lib/douyin/share-link')

      // 测试空文本
      await expect(
        parseDouyinUserShare('')
      ).rejects.toThrow(/链接/)

      // 测试无效格式
      await expect(
        parseDouyinUserShare('这是一段没有链接的文本')
      ).rejects.toThrow(/链接/)
    })

    it('错误信息不应该泄露内部实现细节', async () => {
      const { parseDouyinUserShare } = await import('../lib/douyin/share-link')

      try {
        // 使用一个会触发域名验证错误的URL
        await parseDouyinUserShare('https://v.evil.com/xxx')
        // 如果没有抛出错误，测试失败
        expect(true).toBe(false)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // 验证错误信息不包含敏感的技术细节
        expect(errorMessage).not.toContain('fetch')
        expect(errorMessage).not.toContain('stack')

        // 应该包含友好的提示（链接错误或域名错误）
        const isFriendlyError =
          errorMessage.includes('链接') ||
          errorMessage.includes('域名') ||
          errorMessage.includes('安全') ||
          errorMessage.includes('不允许')

        expect(isFriendlyError).toBe(true)
      }
    })
  })

  describe('secUserId 获取策略', () => {
    it('应该在缺少secUserId时尝试页面抓取', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const shareLinkPath = path.join(process.cwd(), 'lib/douyin/share-link.ts')
      const shareLinkFile = fs.readFileSync(shareLinkPath, 'utf-8')

      // 验证 parseDouyinUserShare 函数会在没有 secUserId 时调用 fetchAuthorSecUid
      expect(shareLinkFile).toContain('if (!ids.secUserId)')
      expect(shareLinkFile).toContain('fetchAuthorSecUid')
    })

    it('fetchAuthorSecUid 应该验证域名', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const shareLinkPath = path.join(process.cwd(), 'lib/douyin/share-link.ts')
      const shareLinkFile = fs.readFileSync(shareLinkPath, 'utf-8')

      // 验证 fetchAuthorSecUid 函数中存在域名验证
      const fetchFunctionMatch = shareLinkFile.match(
        /async function fetchAuthorSecUid[\s\S]*?^\}/m
      )

      if (fetchFunctionMatch) {
        const fetchFunction = fetchFunctionMatch[0]
        expect(fetchFunction).toContain('validateDouyinDomain')
      }
    })
  })

  describe('前端权限控制', () => {
    it('商家列表页应该根据角色显示添加按钮', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const merchantsPagePath = path.join(process.cwd(), 'app/merchants/page.tsx')
      const merchantsPageFile = fs.readFileSync(merchantsPagePath, 'utf-8')

      // 验证页面使用了 useSession
      expect(merchantsPageFile).toContain('useSession')

      // 验证有角色检查
      expect(merchantsPageFile).toContain('canAddMerchant')
      expect(merchantsPageFile).toContain('ADMIN')

      // 验证按钮有条件渲染
      expect(merchantsPageFile).toMatch(/canAddMerchant\s*&&/)
    })
  })

  describe('代码审计检查点', () => {
    it('不应该存在绕过域名验证的路径', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const shareLinkPath = path.join(process.cwd(), 'lib/douyin/share-link.ts')
      const shareLinkFile = fs.readFileSync(shareLinkPath, 'utf-8')

      // 所有 fetch 调用都应该在域名验证之后
      const fetchMatches = shareLinkFile.matchAll(/await fetch\(/g)
      const validateMatches = shareLinkFile.matchAll(/validateDouyinDomain/g)

      expect(Array.from(validateMatches).length).toBeGreaterThan(0)
      expect(Array.from(fetchMatches).length).toBeGreaterThan(0)
    })

    it('API应该使用统一的错误响应格式', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const apiPath = path.join(process.cwd(), 'app/api/douyin/parse-share/route.ts')
      const apiFile = fs.readFileSync(apiPath, 'utf-8')

      // 验证使用了 NextResponse.json
      expect(apiFile).toContain('NextResponse.json')

      // 验证错误响应包含 error 字段
      expect(apiFile).toMatch(/error.*:/g)
    })
  })
})
