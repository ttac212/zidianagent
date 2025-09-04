/**
 * 测试输入框重置修复是否生效
 * 这个脚本会访问工作区页面并验证输入框重置功能
 */

const puppeteer = require('puppeteer');

async function testInputResetFix() {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // 显示浏览器窗口便于观察
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // 监听控制台输出，特别是我们的调试信息
    page.on('console', msg => {
      if (msg.text().includes('📐')) {
        );
      }
    });
    
    await page.goto('http://localhost:3007/workspace', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    await page.waitForTimeout(3000);
    
    // 查找输入框
    const textarea = await page.$('textarea[data-chat-composer-input]');
    if (!textarea) {
      throw new Error('未找到聊天输入框');
    }
    
    const testText = '这是一段很长的测试文本，用来测试输入框在内容较多时的高度变化和重置功能。这段文本应该会让输入框的高度增加到超过初始的72px高度，这样我们就可以验证重置功能是否正常工作。';
    await textarea.focus();
    await textarea.type(testText);
    
    // 等待高度调整
    await page.waitForTimeout(500);
    
    // 获取输入后的高度
    const heightAfterInput = await textarea.evaluate(el => el.offsetHeight);
    if (heightAfterInput <= 72) {
      }
    
    // 查找发送按钮并点击
    const sendButton = await page.$('button[aria-label="发送"]');
    if (!sendButton) {
      throw new Error('未找到发送按钮');
    }
    
    // 点击发送按钮
    await sendButton.click();
    
    // 等待重置完成
    await page.waitForTimeout(200);
    
    // 检查输入框内容是否清空
    const valueAfterSend = await textarea.evaluate(el => el.value);
    const heightAfterSend = await textarea.evaluate(el => el.offsetHeight);
    
    `);
    // 验证结果
    const contentCleared = valueAfterSend === '';
    const heightReset = heightAfterSend <= 80; // 72px + 一些容差
    
    if (contentCleared && heightReset) {
      } else {
      if (!contentCleared) {
        }
      if (!heightReset) {
        `);
      }
    }
    
  } catch (error) {
    } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 检查是否安装了puppeteer
try {
  require('puppeteer');
  testInputResetFix();
} catch (error) {
  }