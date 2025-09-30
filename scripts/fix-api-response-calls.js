#!/usr/bin/env node

const fs = require('fs').promises
const path = require('path')
const glob = require('glob')

async function fixApiResponses() {
  const files = glob.sync('app/api/**/*.ts')

  let fixed = 0
  const errors = []

  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf-8')
      let modified = false

      // 修复error调用方式 - 第一个参数是对象的情况
      content = content.replace(
        /\berror\(\s*\{\s*error:\s*["']([^"']+)["']\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)/g,
        (match, message) => {
          modified = true
          return `unauthorized('${message}')`
        }
      )

      content = content.replace(
        /\berror\(\s*\{\s*error:\s*["']([^"']+)["']\s*\}\s*,\s*\{\s*status:\s*403\s*\}\s*\)/g,
        (match, message) => {
          modified = true
          return `forbidden('${message}')`
        }
      )

      content = content.replace(
        /\berror\(\s*\{\s*error:\s*["']([^"']+)["']\s*\}\s*,\s*\{\s*status:\s*404\s*\}\s*\)/g,
        (match, message) => {
          modified = true
          return `notFound('${message}')`
        }
      )

      content = content.replace(
        /\berror\(\s*\{\s*error:\s*["']([^"']+)["']\s*\}\s*\)/g,
        (match, message) => {
          modified = true
          return `error('${message}')`
        }
      )

      // 修复serverError调用
      content = content.replace(
        /\berror\(\s*\{\s*success:\s*false,\s*error:\s*["']([^"']+)["']\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
        (match, message) => {
          modified = true
          return `serverError('${message}')`
        }
      )

      // 修复 validationError - 参数结构错误
      // 原: validationError('message', fieldErrors)
      // 新: validationError('message', { details: fieldErrors })
      content = content.replace(
        /\bvalidationError\((['"].*?['"]),\s*(\w+)\)/g,
        (match, message, details) => {
          if (details !== 'undefined' && !details.includes('{')) {
            modified = true
            return `validationError(${message}, { details: ${details} })`
          }
          return match
        }
      )

      // 修复 unauthorized 双参数问题
      content = content.replace(
        /\bunauthorized\((['"].*?['"]),\s*(\{[^}]+\})\)/g,
        (match, message, extra) => {
          modified = true
          // 将第二个参数作为details传入options
          return `unauthorized(${message}, { details: ${extra} })`
        }
      )

      if (modified) {
        await fs.writeFile(file, content)
        console.log(`✅ Fixed: ${file}`)
        fixed++
      }
    } catch (err) {
      errors.push({ file, error: err.message })
    }
  }

  console.log(`\n总共修复了 ${fixed} 个文件`)

  if (errors.length > 0) {
    console.log('\n❌ 错误：')
    errors.forEach(({ file, error }) => {
      console.log(`  ${file}: ${error}`)
    })
  }
}

fixApiResponses().catch(console.error)