import type { Metadata } from "next"

import { ProfileDocumentEditor } from "@/components/merchants/profile-document-editor"

interface PageProps {
  params: { id: string }
}

export const metadata: Metadata = {
  title: "商家创作档案 - 文档模式",
  description: "全屏文档模式，分段编辑商家创作档案。"
}

export default function MerchantProfileDocumentPage({ params }: PageProps) {
  return <ProfileDocumentEditor merchantId={params.id} />
}
