import { Loader2 } from "lucide-react"

interface LoadingPageProps {
  message?: string
}

export function LoadingPage({ message = "加载中..." }: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  )
}
