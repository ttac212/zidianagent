export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>加载设置...</span>
      </div>
    </div>
  )
}
