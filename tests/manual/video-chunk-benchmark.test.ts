import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { VideoProcessor } from '@/lib/video/video-processor'

const TEST_HOST = '127.0.0.1'

interface ByteRange {
  start: number
  end: number
}

function parseRangeHeader(range: string | undefined, size: number): ByteRange | null {
  if (!range || !range.startsWith('bytes=')) return null
  const [startText, endText] = range.replace('bytes=', '').split('-', 2)
  const start = Number(startText)
  const end = endText ? Number(endText) : size - 1
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return null
  return {
    start,
    end: Math.min(end, size - 1),
  }
}

function createVideoServer(payload: Buffer) {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'HEAD') {
      res.statusCode = 200
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', payload.length)
      res.end()
      return
    }

    const range = parseRangeHeader(req.headers.range, payload.length)
    if (range) {
      const chunk = payload.subarray(range.start, range.end + 1)
      res.statusCode = 206
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', chunk.length)
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${payload.length}`)
      res.end(chunk)
      return
    }

    res.statusCode = 200
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', payload.length)
    res.end(payload)
  })

  return new Promise<{ close: () => Promise<void>; url: string }>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, TEST_HOST, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const url = `http://${TEST_HOST}:${address.port}/video`
        resolve({
          url,
          close: () =>
            new Promise<void>((closeResolve) => {
              server.close(() => closeResolve())
            }),
        })
      } else {
        reject(new Error('无法获取测试服务器端口'))
      }
    })
  })
}

describe.skip('video chunk benchmark (手动运行)', () => {
  it('大文件分块下载耗时', async () => {
    const totalSizeMb = 32
    const totalSize = totalSizeMb * 1024 * 1024
    const chunkSize = 4 * 1024 * 1024
    const concurrency = 4

    const payload = Buffer.alloc(totalSize, 0x1f)
    const server = await createVideoServer(payload)

    try {
      const info = await VideoProcessor.getVideoInfo(server.url)
      expect(info.supportsRange).toBe(true)

      const start = performance.now()
      const result = await VideoProcessor.downloadVideo(server.url, info, {
        chunkSize,
        concurrency,
      })
      const elapsedMs = performance.now() - start

      console.log(
        `[benchmark] 分块下载 ${totalSizeMb}MB 耗时 ${elapsedMs.toFixed(
          2,
        )}ms (strategy=${result.strategy}, chunks=${result.chunkCount}, chunk=${chunkSize}B, concurrency=${concurrency})`,
      )

      expect(result.buffer.length).toBe(totalSize)
      expect(result.strategy).toBe('chunked')
      expect(result.chunkCount).toBeGreaterThan(1)
      expect(elapsedMs).toBeGreaterThan(0)
    } finally {
      await server.close()
    }
  })

  it('小文件走快速完整下载路径', async () => {
    const totalSizeKb = 512
    const totalSize = totalSizeKb * 1024
    const payload = Buffer.alloc(totalSize, 0x2a)
    const server = await createVideoServer(payload)

    try {
      const info = await VideoProcessor.getVideoInfo(server.url)
      const start = performance.now()
      const result = await VideoProcessor.downloadVideo(server.url, info, {
        chunkSize: 4 * 1024 * 1024,
        concurrency: 4,
      })
      const elapsedMs = performance.now() - start

      console.log(
        `[benchmark] 小文件下载 ${totalSizeKb}KB 耗时 ${elapsedMs.toFixed(
          2,
        )}ms (strategy=${result.strategy})`,
      )

      expect(result.buffer.length).toBe(totalSize)
      expect(result.strategy).toBe('single')
      expect(result.chunkCount).toBe(1)
      expect(elapsedMs).toBeGreaterThanOrEqual(0)
    } finally {
      await server.close()
    }
  })
})
