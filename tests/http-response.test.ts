import { describe, it, expect, vi } from 'vitest'
import {
  HttpResponse,
  success,
  error,
  paginated,
  isSuccessResponse,
  isErrorResponse,
  isPaginatedResponse,
  calculatePaginationMeta,
  extractPaginationParams,
  parseApiResponse
} from '@/lib/api/http-response'

describe('HTTP Response 统一工具', () => {
  describe('HttpResponse 类方法', () => {
    it('应该创建成功响应', async () => {
      const data = { id: 1, name: 'test' }
      const response = HttpResponse.success(data)

      expect(response.status).toBe(200)

      // 测试响应体内容
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual(data)
      expect(body.timestamp).toBeDefined()
    })

    it('应该创建错误响应', async () => {
      const message = 'Something went wrong'
      const response = HttpResponse.error(message)

      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toBe(message)
      expect(body.timestamp).toBeDefined()
    })

    it('应该创建分页响应', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      const meta = calculatePaginationMeta(1, 10, 20)
      const response = HttpResponse.paginated(items, meta)

      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual(items)
      expect(body.meta).toEqual(meta)
    })

    it('应该创建 404 响应', () => {
      const response = HttpResponse.notFound()
      expect(response.status).toBe(404)
    })

    it('应该创建 401 响应', () => {
      const response = HttpResponse.unauthorized()
      expect(response.status).toBe(401)
    })

    it('应该创建 403 响应', () => {
      const response = HttpResponse.forbidden()
      expect(response.status).toBe(403)
    })

    it('应该创建验证错误响应', async () => {
      const errors = { email: ['Invalid email'], password: ['Too short'] }
      const response = HttpResponse.validationError('Validation failed', errors)

      expect(response.status).toBe(422)

      const body = await response.json()
      expect(body.details).toEqual(errors)
    })

    it('应该创建速率限制响应', () => {
      const response = HttpResponse.tooManyRequests('Rate limit exceeded', 60)
      expect(response.status).toBe(429)
      expect(response.headers?.get('Retry-After')).toBe('60')
    })

    it('在开发环境显示服务器错误详情', async () => {
      // 使用Vitest mock代替直接赋值
      vi.stubEnv('NODE_ENV', 'development')

      const errorDetails = { stack: 'Error stack' }
      const response = HttpResponse.serverError('Server error', errorDetails)

      const body = await response.json()
      expect(body.details).toEqual(errorDetails)

      vi.unstubAllEnvs()
    })

    it('在生产环境隐藏服务器错误详情', async () => {
      // 使用Vitest mock代替直接赋值
      vi.stubEnv('NODE_ENV', 'production')

      const errorDetails = { stack: 'Error stack' }
      const response = HttpResponse.serverError('Server error', errorDetails)

      const body = await response.json()
      expect(body.details).toBeUndefined()

      vi.unstubAllEnvs()
    })
  })

  describe('类型守卫', () => {
    it('isSuccessResponse 应该正确判断成功响应', () => {
      const successResp = { success: true, data: { id: 1 } }
      const errorResp = { success: false, error: 'Error' }

      expect(isSuccessResponse(successResp)).toBe(true)
      expect(isSuccessResponse(errorResp)).toBe(false)
    })

    it('isErrorResponse 应该正确判断错误响应', () => {
      const successResp = { success: true, data: { id: 1 } }
      const errorResp = { success: false, error: 'Error' }

      expect(isErrorResponse(successResp)).toBe(false)
      expect(isErrorResponse(errorResp)).toBe(true)
    })

    it('isPaginatedResponse 应该正确判断分页响应', () => {
      const paginatedResp = {
        success: true,
        data: [{ id: 1 }],
        meta: calculatePaginationMeta(1, 10, 20)
      }
      const regularResp = { success: true, data: [{ id: 1 }] }

      expect(isPaginatedResponse(paginatedResp)).toBe(true)
      expect(isPaginatedResponse(regularResp)).toBe(false)
    })
  })

  describe('分页工具', () => {
    it('calculatePaginationMeta 应该正确计算分页元数据', () => {
      const meta = calculatePaginationMeta(2, 10, 35)

      expect(meta).toEqual({
        page: 2,
        pageSize: 10,
        total: 35,
        totalPages: 4,
        hasNext: true,
        hasPrev: true
      })
    })

    it('calculatePaginationMeta 处理边界情况', () => {
      // 第一页
      const firstPage = calculatePaginationMeta(1, 10, 20)
      expect(firstPage.hasPrev).toBe(false)
      expect(firstPage.hasNext).toBe(true)

      // 最后一页
      const lastPage = calculatePaginationMeta(2, 10, 20)
      expect(lastPage.hasPrev).toBe(true)
      expect(lastPage.hasNext).toBe(false)

      // 只有一页
      const singlePage = calculatePaginationMeta(1, 10, 5)
      expect(singlePage.hasPrev).toBe(false)
      expect(singlePage.hasNext).toBe(false)
    })

    it('extractPaginationParams 应该从查询参数提取分页信息', () => {
      const params = new URLSearchParams('page=3&pageSize=25')
      const result = extractPaginationParams(params)

      expect(result).toEqual({
        page: 3,
        pageSize: 25
      })
    })

    it('extractPaginationParams 应该使用默认值', () => {
      const params = new URLSearchParams('')
      const result = extractPaginationParams(params)

      expect(result).toEqual({
        page: 1,
        pageSize: 20
      })
    })

    it('extractPaginationParams 应该限制最大页面大小', () => {
      const params = new URLSearchParams('pageSize=200')
      const result = extractPaginationParams(params)

      expect(result.pageSize).toBe(100) // 最大100
    })

    it('extractPaginationParams 应该限制最小页码', () => {
      const params = new URLSearchParams('page=0')
      const result = extractPaginationParams(params)

      expect(result.page).toBe(1) // 最小1
    })
  })

  describe('parseApiResponse', () => {
    it('应该解析标准格式的成功响应', async () => {
      const mockResponse = new Response(
        JSON.stringify({ success: true, data: { id: 1 } }),
        { status: 200 }
      )

      const result = await parseApiResponse(mockResponse)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1 })
    })

    it('应该解析非标准格式的成功响应', async () => {
      const mockResponse = new Response(
        JSON.stringify({ id: 1, name: 'test' }),
        { status: 200 }
      )

      const result = await parseApiResponse(mockResponse)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1, name: 'test' })
    })

    it('应该解析错误响应', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404 }
      )

      const result = await parseApiResponse(mockResponse)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
    })

    it('应该处理解析失败', async () => {
      const mockResponse = new Response('Invalid JSON', { status: 200 })

      const result = await parseApiResponse(mockResponse)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to parse response')
    })
  })

  describe('便捷导出函数', () => {
    it('应该正确导出所有便捷函数', () => {
      expect(success).toBe(HttpResponse.success)
      expect(error).toBe(HttpResponse.error)
      expect(paginated).toBe(HttpResponse.paginated)
    })
  })
})