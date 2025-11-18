/**
 * TikHub API 城市列表测试脚本
 *
 * 测试 TikHub API 的中国城市列表接口
 * 端点: /api/v1/douyin/billboard/fetch_city_list
 *
 * 使用方法:
 * npx tsx scripts/test-city-list.ts
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { CityInfo } from '@/lib/tikhub/types'

/**
 * 根据城市代码推断省份代码
 * 城市代码的前2位代表省份
 */
function getProvinceCode(cityCode: number): number {
  return Math.floor(cityCode / 10000) * 10000
}

/**
 * 根据省份代码获取省份名称
 */
function getProvinceName(provinceCode: number, cities: CityInfo[]): string {
  // 查找该省份代码对应的直辖市或省会城市
  const provinceCity = cities.find((c) => c.value === provinceCode)
  if (provinceCity) {
    return provinceCity.label
  }

  // 如果没找到，返回代码
  return `省份代码${provinceCode}`
}

/**
 * 按省份分组城市
 */
function groupCitiesByProvince(cities: CityInfo[]): Map<string, CityInfo[]> {
  const provinceMap = new Map<string, CityInfo[]>()

  // 第一遍：按省份代码分组
  const codeGroups = new Map<number, CityInfo[]>()
  cities.forEach((city) => {
    const provinceCode = getProvinceCode(city.value)
    if (!codeGroups.has(provinceCode)) {
      codeGroups.set(provinceCode, [])
    }
    codeGroups.get(provinceCode)!.push(city)
  })

  // 第二遍：转换为以省份名称为键的Map
  codeGroups.forEach((provinceCities, provinceCode) => {
    const provinceName = getProvinceName(provinceCode, cities)
    provinceMap.set(provinceName, provinceCities)
  })

  return provinceMap
}

/**
 * 测试获取城市列表
 */
async function testGetCityList() {
  console.log('=== 测试获取中国城市列表 ===\n')

  try {
    // 创建客户端时显式传递配置
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log('正在获取城市列表...\n')
    const response = await client.getCityList()

    // 检查响应数据
    if (!response || !response.data || !Array.isArray(response.data)) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const cities = response.data
    console.log(`✅ 成功获取城市列表`)
    console.log(`总计: ${cities.length} 个城市\n`)

    // 按省份分组
    const provinceMap = groupCitiesByProvince(cities)
    console.log(`省份数量: ${provinceMap.size}\n`)

    // 显示前10个省份的城市
    console.log('=== 省份及城市预览（前10个省份）===\n')
    let provinceCount = 0
    for (const [provinceName, provinceCities] of provinceMap) {
      if (provinceCount >= 10) break

      console.log(`📍 ${provinceName} (${provinceCities.length} 个城市)`)

      // 显示前5个城市
      const displayCities = provinceCities.slice(0, 5)
      displayCities.forEach((city, index) => {
        const isLast = index === displayCities.length - 1 && displayCities.length === provinceCities.length
        const prefix = isLast ? '   └─' : '   ├─'
        console.log(`${prefix} ${city.label} (代码: ${city.value})`)
      })

      if (provinceCities.length > 5) {
        console.log(`   └─ ... 还有 ${provinceCities.length - 5} 个城市`)
      }

      console.log()
      provinceCount++
    }

    if (provinceMap.size > 10) {
      console.log(`... 还有 ${provinceMap.size - 10} 个省份\n`)
    }

    // 统计信息
    console.log('=== 详细统计 ===\n')

    // 计算每个省份的城市数量
    const provinceCounts = Array.from(provinceMap.entries())
      .map(([name, cities]) => ({ name, count: cities.length }))
      .sort((a, b) => b.count - a.count)

    console.log('城市数量最多的省份（前5名）:')
    provinceCounts.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}: ${item.count} 个城市`)
    })
    console.log()

    // 保存完整数据到文件（可选）
    const fs = await import('fs/promises')
    const outputPath = './city-list-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          total: cities.length,
          provinces: provinceMap.size,
          data: response,
          grouped: Object.fromEntries(provinceMap),
        },
        null,
        2
      )
    )
    console.log(`📄 完整数据已保存到: ${outputPath}\n`)

    return true
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.details) {
      console.error('详细信息:', JSON.stringify(error.details, null, 2))
    }
    return false
  }
}

/**
 * 测试搜索特定城市
 */
async function testSearchCity(cityName: string) {
  console.log(`=== 搜索城市: "${cityName}" ===\n`)

  try {
    // 创建客户端时显式传递配置
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })
    const response = await client.getCityList()

    if (!response || !response.data || !Array.isArray(response.data)) {
      console.error('❌ 无法获取城市列表')
      return false
    }

    const matchedCities = response.data.filter((city) => city.label.includes(cityName))

    if (matchedCities.length === 0) {
      console.log(`⚠️  未找到包含"${cityName}"的城市`)
      return true
    }

    console.log(`找到 ${matchedCities.length} 个匹配的城市:\n`)
    matchedCities.forEach((city, index) => {
      const provinceCode = getProvinceCode(city.value)
      const provinceName = getProvinceName(provinceCode, response.data)

      console.log(`${index + 1}. ${city.label}`)
      console.log(`   省份: ${provinceName}`)
      console.log(`   城市代码: ${city.value}`)
      console.log(`   省份代码: ${provinceCode}`)
      console.log()
    })

    return true
  } catch (error: any) {
    console.error('❌ 搜索失败:', error.message)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API - 中国城市列表测试工具            ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 检查命令行参数
  const args = process.argv.slice(2)
  const searchCity = args.find((arg) => arg.startsWith('--search='))?.split('=')[1]

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (searchCity) {
    // 如果指定了搜索参数，只执行搜索
    tests.push({
      name: `搜索城市: ${searchCity}`,
      fn: () => testSearchCity(searchCity),
    })
  } else {
    // 否则执行完整测试
    tests.push({
      name: '获取城市列表',
      fn: testGetCityList,
    })
  }

  const results: Array<{ name: string; passed: boolean }> = []

  for (const test of tests) {
    const passed = await test.fn()
    results.push({ name: test.name, passed })

    // 每个测试之间延迟500ms
    if (tests.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // 输出测试摘要
  if (results.length > 1) {
    console.log('\n╔══════════════════════════════════════════════════╗')
    console.log('║              测试结果摘要                        ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    results.forEach(({ name, passed }) => {
      const status = passed ? '✅ 通过' : '❌ 失败'
      console.log(`${name.padEnd(30)} ${status}`)
    })

    const totalPassed = results.filter((r) => r.passed).length
    const totalTests = results.length

    console.log(`\n总计: ${totalPassed}/${totalTests} 测试通过`)

    if (totalPassed === totalTests) {
      console.log('\n🎉 所有测试通过！\n')
    } else {
      console.log('\n⚠️  部分测试失败，请检查错误信息。\n')
    }
  }
}

// 运行测试
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('测试运行失败:', error)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}

export { testGetCityList, testSearchCity }
