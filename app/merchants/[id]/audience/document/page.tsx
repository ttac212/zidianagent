import type { Metadata } from "next"

import { AudienceDocumentEditor } from "@/components/merchants/audience-document-editor"

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "客群对齐文档",
  description: "全屏文档模式，编辑客群分析与推进计划。"
}

export default async function MerchantAudienceDocumentPage({ params }: PageProps) {
  const { id } = await params
  return <AudienceDocumentEditor merchantId={id} />
}
