import type React from "react"
import type { Metadata } from "next"
// 暂时禁用Google Fonts，避免连接警告
// import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/lib/providers/query-provider"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import '@/lib/config/env-init'

// 使用系统字体配置，避免Google Fonts连接问题
const inter = {
  className: "font-sans",
  variable: "--font-inter",
  style: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
  }
}

export const metadata: Metadata = {
  title: "支点有星辰 - AI创作平台",
  description: "专业的AI内容创作平台，助力短视频文案创作",
  generator: "ZDZD",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <style>{`
html {
  font-family: ${inter.style.fontFamily};
  --font-sans: ${inter.variable};
}
        `}</style>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <SessionProvider>
              <QueryProvider>
                {children}
                <SonnerToaster
                  position="top-center"
                  richColors
                  closeButton
                  duration={4000}
                  visibleToasts={3}
                  theme="system"
                />
              </QueryProvider>
            </SessionProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
