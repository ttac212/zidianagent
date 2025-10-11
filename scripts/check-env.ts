#!/usr/bin/env ts-node

import { validateProductionEnv } from '../lib/config/env-guard'

async function main() {
  try {
    validateProductionEnv(console)
    console.log('[EnvGuard] 环境变量检查通过')
  } catch (error) {
    console.error('[EnvGuard] 环境变量检查失败')
    console.error(error)
    process.exit(1)
  }
}

void main()

export {}
