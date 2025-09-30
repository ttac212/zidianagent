/**
 * 时间处理工具库测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as dt from '../lib/utils/date-toolkit'

describe('Date Toolkit', () => {
  beforeEach(() => {
    // 固定时间为 2025-01-28 10:00:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-28T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('基础时间获取', () => {
    it('now() 应返回当前时间', () => {
      const date = dt.now()
      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe('2025-01-28T10:00:00.000Z')
    })

    it('timestamp() 应返回时间戳', () => {
      const ts = dt.timestamp()
      expect(typeof ts).toBe('number')
      expect(ts).toBe(new Date('2025-01-28T10:00:00.000Z').getTime())
    })

    it('toISO() 应返回ISO字符串', () => {
      const iso = dt.toISO()
      expect(iso).toBe('2025-01-28T10:00:00.000Z')
    })

    it('toDateString() 应返回日期字符串', () => {
      const dateStr = dt.toDateString()
      expect(dateStr).toBe('2025-01-28')
    })

    it('toTimeString() 应返回时间字符串', () => {
      const timeStr = dt.toTimeString()
      expect(timeStr).toBe('10:00:00')
    })
  })

  describe('日期解析和验证', () => {
    it('parse() 应正确解析有效日期', () => {
      expect(dt.parse('2025-01-28')).toBeInstanceOf(Date)
      expect(dt.parse(new Date())).toBeInstanceOf(Date)
      expect(dt.parse(null)).toBeNull()
      expect(dt.parse(undefined)).toBeNull()
      expect(dt.parse('invalid')).toBeNull()
    })

    it('isValid() 应正确验证日期', () => {
      expect(dt.isValid(new Date())).toBe(true)
      expect(dt.isValid(new Date('invalid'))).toBe(false)
      expect(dt.isValid('string')).toBe(false)
      expect(dt.isValid(null)).toBe(false)
    })
  })

  describe('日期比较和排序', () => {
    it('compare() 应正确比较日期', () => {
      const d1 = new Date('2025-01-28')
      const d2 = new Date('2025-01-29')
      const d3 = new Date('2025-01-28')

      expect(dt.compare(d1, d2)).toBe(-1)
      expect(dt.compare(d2, d1)).toBe(1)
      expect(dt.compare(d1, d3)).toBe(0)
    })

    it('sortByDate() 应正确排序', () => {
      const items = [
        { date: '2025-01-29' },
        { date: '2025-01-27' },
        { date: '2025-01-28' }
      ]

      // 升序
      const sorted = [...items].sort(dt.sortByDate(item => item.date))
      expect(sorted[0].date).toBe('2025-01-27')
      expect(sorted[2].date).toBe('2025-01-29')

      // 降序
      const sortedDesc = [...items].sort(dt.sortByDate(item => item.date, true))
      expect(sortedDesc[0].date).toBe('2025-01-29')
      expect(sortedDesc[2].date).toBe('2025-01-27')
    })
  })

  describe('日期计算', () => {
    it('add() 应正确添加时间', () => {
      const date = new Date('2025-01-28T10:00:00.000Z')

      expect(dt.add(date, 1, 'days').toISOString()).toBe('2025-01-29T10:00:00.000Z')
      expect(dt.add(date, 2, 'hours').toISOString()).toBe('2025-01-28T12:00:00.000Z')
      expect(dt.add(date, 30, 'minutes').toISOString()).toBe('2025-01-28T10:30:00.000Z')
      expect(dt.add(date, 1, 'months').toISOString()).toBe('2025-02-28T10:00:00.000Z')
      expect(dt.add(date, 1, 'years').toISOString()).toBe('2026-01-28T10:00:00.000Z')
    })

    it('subtract() 应正确减去时间', () => {
      const date = new Date('2025-01-28T10:00:00.000Z')

      expect(dt.subtract(date, 1, 'days').toISOString()).toBe('2025-01-27T10:00:00.000Z')
      expect(dt.subtract(date, 2, 'hours').toISOString()).toBe('2025-01-28T08:00:00.000Z')
    })

    it('diff() 应正确计算时间差', () => {
      const d1 = new Date('2025-01-28T10:00:00.000Z')
      const d2 = new Date('2025-01-29T10:00:00.000Z')

      expect(dt.diff(d1, d2, 'days')).toBe(1)
      expect(dt.diff(d1, d2, 'hours')).toBe(24)
      expect(dt.diff(d1, d2, 'minutes')).toBe(1440)
      expect(dt.diff(d1, d2, 'seconds')).toBe(86400)
    })
  })

  describe('相对时间', () => {
    it('fromNow() 应返回中文相对时间', () => {
      const now = new Date('2025-01-28T10:00:00.000Z')
      vi.setSystemTime(now)

      expect(dt.fromNow(now)).toBe('刚刚')
      expect(dt.fromNow(new Date(now.getTime() - 30000))).toBe('刚刚')
      expect(dt.fromNow(new Date(now.getTime() - 120000))).toBe('2 分钟前')
      expect(dt.fromNow(new Date(now.getTime() - 3700000))).toBe('1 小时前')
      expect(dt.fromNow(new Date(now.getTime() - 90000000))).toBe('1 天前')
    })

    it('fromNow() 应返回英文相对时间', () => {
      const now = new Date('2025-01-28T10:00:00.000Z')
      vi.setSystemTime(now)

      expect(dt.fromNow(now, 'en')).toBe('just now')
      expect(dt.fromNow(new Date(now.getTime() - 120000), 'en')).toBe('2 minutes ago')
      expect(dt.fromNow(new Date(now.getTime() - 3700000), 'en')).toBe('1 hours ago')
    })
  })

  describe('日期范围检查', () => {
    it('isBetween() 应正确检查范围', () => {
      const date = new Date('2025-01-28')
      const start = new Date('2025-01-27')
      const end = new Date('2025-01-29')

      expect(dt.isBetween(date, start, end)).toBe(true)
      expect(dt.isBetween(start, date, end)).toBe(false)
    })

    it('isPast() 应检查是否过去', () => {
      vi.setSystemTime(new Date('2025-01-28T10:00:00.000Z'))

      expect(dt.isPast('2025-01-27')).toBe(true)
      expect(dt.isPast('2025-01-29')).toBe(false)
    })

    it('isFuture() 应检查是否未来', () => {
      vi.setSystemTime(new Date('2025-01-28T10:00:00.000Z'))

      expect(dt.isFuture('2025-01-29')).toBe(true)
      expect(dt.isFuture('2025-01-27')).toBe(false)
    })

    it('isToday() 应检查是否今天', () => {
      vi.setSystemTime(new Date('2025-01-28T10:00:00.000Z'))

      expect(dt.isToday('2025-01-28T15:00:00')).toBe(true)
      expect(dt.isToday('2025-01-27')).toBe(false)
    })
  })

  describe('日期边界', () => {
    it('startOfDay() 应返回一天开始', () => {
      const date = new Date('2025-01-28T15:30:45.123Z')
      const start = dt.startOfDay(date)

      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)
      expect(start.getMilliseconds()).toBe(0)
    })

    it('endOfDay() 应返回一天结束', () => {
      const date = new Date('2025-01-28T15:30:45.123Z')
      const end = dt.endOfDay(date)

      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
      expect(end.getMilliseconds()).toBe(999)
    })

    it('startOfMonth() 应返回月初', () => {
      const date = new Date('2025-01-15T15:30:45.123Z')
      const start = dt.startOfMonth(date)

      expect(start.getDate()).toBe(1)
      expect(start.getHours()).toBe(0)
    })

    it('endOfMonth() 应返回月末', () => {
      const date = new Date('2025-01-15T15:30:45.123Z')
      const end = dt.endOfMonth(date)

      expect(end.getMonth()).toBe(0) // January
      expect(end.getDate()).toBe(31)
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
    })
  })

  describe('Timer 计时器', () => {
    it('应正确计时', () => {
      const timer = new dt.Timer()

      vi.advanceTimersByTime(1000)
      expect(timer.elapsed()).toBe(1000)
      expect(timer.elapsedSeconds()).toBe(1)

      vi.advanceTimersByTime(500)
      expect(timer.elapsed()).toBe(1500)

      timer.reset()
      expect(timer.elapsed()).toBe(0)
    })

    it('lap() 应返回经过时间并重置', () => {
      const timer = new dt.Timer()

      vi.advanceTimersByTime(1000)
      const lap1 = timer.lap()
      expect(lap1).toBe(1000)

      vi.advanceTimersByTime(500)
      const lap2 = timer.lap()
      expect(lap2).toBe(500)
    })
  })

  describe('工具函数', () => {
    it('uniqueId() 应生成唯一ID', () => {
      const id1 = dt.uniqueId()
      const id2 = dt.uniqueId()
      expect(id1).not.toBe(id2)

      const prefixedId = dt.uniqueId('user')
      expect(prefixedId).toMatch(/^user_/)
    })

    it('formatDuration() 应格式化持续时间', () => {
      expect(dt.formatDuration(1000)).toBe('1秒')
      expect(dt.formatDuration(61000)).toBe('1分钟1秒')
      expect(dt.formatDuration(3661000)).toBe('1小时1分钟')
      expect(dt.formatDuration(90061000)).toBe('1天1小时')

      expect(dt.formatDuration(61000, 'en')).toBe('1m 1s')
      expect(dt.formatDuration(3661000, 'en')).toBe('1h 1m')
    })
  })

  describe('时间常量', () => {
    it('TIME 常量应有正确值', () => {
      expect(dt.TIME.SECOND).toBe(1000)
      expect(dt.TIME.MINUTE).toBe(60 * 1000)
      expect(dt.TIME.HOUR).toBe(60 * 60 * 1000)
      expect(dt.TIME.DAY).toBe(24 * 60 * 60 * 1000)
      expect(dt.TIME.WEEK).toBe(7 * 24 * 60 * 60 * 1000)
    })
  })

  describe('默认导出', () => {
    it('应导出所有函数', () => {
      const defaultExport = dt.default
      expect(defaultExport.now).toBeDefined()
      expect(defaultExport.timestamp).toBeDefined()
      expect(defaultExport.toISO).toBeDefined()
      expect(defaultExport.parse).toBeDefined()
      expect(defaultExport.Timer).toBeDefined()
      expect(defaultExport.TIME).toBeDefined()
    })
  })
})