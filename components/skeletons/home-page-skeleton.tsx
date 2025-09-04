export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
          </div>
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full"></div>
        </div>
      </div>

      {/* Hero section skeleton */}
      <section className="relative overflow-hidden py-32 md:py-40 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl md:max-w-4xl mx-auto md:mx-0 text-center md:text-left">
            <div className="mb-6 h-8 w-32 bg-muted animate-pulse rounded"></div>
            <div className="space-y-4">
              <div className="h-12 md:h-16 bg-muted animate-pulse rounded"></div>
              <div className="h-12 md:h-16 bg-muted animate-pulse rounded w-4/5"></div>
            </div>
            <div className="mt-6 h-6 bg-muted animate-pulse rounded w-3/4"></div>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <div className="h-12 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-12 w-32 bg-muted animate-pulse rounded"></div>
              <div className="h-12 w-24 bg-muted animate-pulse rounded hidden sm:block"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs section skeleton */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6"></div>
          <div className="w-full grid grid-cols-3 gap-1 bg-muted rounded-lg p-1 mb-6">
            <div className="h-10 bg-background rounded"></div>
            <div className="h-10 bg-muted-foreground/10 rounded"></div>
            <div className="h-10 bg-muted-foreground/10 rounded"></div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-24 bg-muted animate-pulse rounded-xl"></div>
            <div className="h-24 bg-muted animate-pulse rounded-xl"></div>
          </div>
        </div>
      </section>

      {/* Cards section skeleton */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <div className="h-6 w-20 bg-muted animate-pulse rounded mx-auto mb-3"></div>
            <div className="h-8 w-64 bg-muted animate-pulse rounded mx-auto"></div>
            <div className="h-4 w-96 bg-muted animate-pulse rounded mx-auto mt-2"></div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}