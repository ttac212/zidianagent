"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

/**
 * 轻量认证就绪 Hook：
 * - 仅在 `authenticated` 时返回 true
 * - `loading` 期返回 false，但不跳转，供页面显示骨架/占位
 * - `unauthenticated` 时可选择性跳转到 /login（默认不自动跳转，交由 middleware 处理服务端重定向）
 */
export function useRequireAuth(options?: { redirectOnUnauthed?: boolean; redirectTo?: string }) {
  const { status } = useSession()
  const router = useRouter()
  const redirectOnUnauthed = options?.redirectOnUnauthed ?? false
  const redirectTo = options?.redirectTo ?? "/login"

  useEffect(() => {
    if (status === "unauthenticated" && redirectOnUnauthed) {
      router.replace(redirectTo)
    }
  }, [status, redirectOnUnauthed, redirectTo, router])

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    status,
  }
}

