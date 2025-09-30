/**
 * 动态UI组件测试脚本
 * 用于发现类似输入框高度适配的问题
 */

const dynamicUITests = {
  // 测试输入框动态高度
  testTextareaHeight: async (page) => {
    const results = []

    // 测试场景1: 空 → 长文本 → 删除
    await page.type('[data-testid="chat-input"]', 'A'.repeat(1000))
    const heightAfterInput = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]')
      return textarea.style.height
    })

    await page.keyboard.selectAll()
    await page.keyboard.press('Delete')
    const heightAfterDelete = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]')
      return textarea.style.height
    })

    results.push({
      test: 'textarea-height-reset',
      passed: heightAfterDelete !== heightAfterInput,
      details: { heightAfterInput, heightAfterDelete }
    })

    // 测试场景2: 快速输入删除循环
    for (let i = 0; i < 5; i++) {
      await page.type('[data-testid="chat-input"]', 'Test line\n'.repeat(i + 1))
      await page.keyboard.selectAll()
      await page.keyboard.press('Delete')
    }

    const finalHeight = await page.evaluate(() => {
      const textarea = document.querySelector('[data-testid="chat-input"]')
      return textarea.style.height
    })

    results.push({
      test: 'rapid-input-delete-cycle',
      passed: finalHeight === '56px', // MIN_HEIGHT
      details: { finalHeight }
    })

    return results
  },

  // 测试状态切换一致性
  testStateTransitions: async (page) => {
    const states = ['normal', 'focused', 'near-limit', 'at-limit', 'loading']
    const results = []

    for (const state of states) {
      // 模拟状态切换
      await page.evaluate((stateName) => {
        const input = document.querySelector('[data-testid="chat-input"]')
        switch (stateName) {
          case 'focused':
            input.focus()
            break
          case 'near-limit':
            input.value = 'A'.repeat(90000) // 90% of MAX_LENGTH
            input.dispatchEvent(new Event('input', { bubbles: true }))
            break
          case 'at-limit':
            input.value = 'A'.repeat(100000) // MAX_LENGTH
            input.dispatchEvent(new Event('input', { bubbles: true }))
            break
        }
      }, state)

      // 检查视觉状态
      const className = await page.evaluate(() => {
        const form = document.querySelector('form[aria-busy]')
        return form.className
      })

      results.push({
        test: `state-${state}`,
        passed: className.includes(state === 'at-limit' ? 'destructive' : state === 'near-limit' ? 'amber' : 'border'),
        details: { state, className }
      })
    }

    return results
  }
}

// 自动运行测试
async function runDynamicUITests() {
  const { chromium } = require('playwright')
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:3007')

  const allResults = []

  try {
    // 运行所有测试
    for (const [testName, testFn] of Object.entries(dynamicUITests)) {
      console.log(`Running ${testName}...`)
      const results = await testFn(page)
      allResults.push(...results)
    }

    // 输出结果
    const passed = allResults.filter(r => r.passed).length
    const total = allResults.length

    console.log(`\n测试结果: ${passed}/${total} 通过`)

    allResults.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      console.log(`${status} ${result.test}`)
      if (!result.passed) {
        console.log(`   详情: ${JSON.stringify(result.details)}`)
      }
    })

  } catch (error) {
    console.error('测试执行失败:', error)
  } finally {
    await browser.close()
  }
}

module.exports = { dynamicUITests, runDynamicUITests }