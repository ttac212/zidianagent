'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LegacyBatchesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const merchantId = searchParams.get('merchantId')

    if (merchantId) {
      router.replace(`/creative/merchants/${merchantId}/batches`)
    }
  }, [router, searchParams])

  return (
    <div className="container mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">批次列表页面已迁移</h1>
      <p className="text-muted-foreground">
        新地址为 <code>/creative/merchants/[merchantId]/batches</code>。请通过左侧菜单或商家页入口访问。
      </p>
      <p className="text-muted-foreground">
        如果您是通过旧链接访问，请在 URL 中附加 <code>?merchantId=xxx</code>，系统会自动跳转到新的页面。
      </p>
    </div>
  )
}
