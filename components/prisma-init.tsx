'use client'

import { useEffect } from 'react'

export function PrismaInit() {
  useEffect(() => {
    // 客户端不需要初始化Prisma
    // 这个组件主要是作为占位符
  }, [])
  
  return null
}