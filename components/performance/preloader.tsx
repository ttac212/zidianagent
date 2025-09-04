"use client"

import { useEffect } from "react"

interface PreloaderProps {
  resources: string[]
  onComplete?: () => void
}

export function Preloader({ resources, onComplete }: PreloaderProps) {
  useEffect(() => {
    const preloadResource = (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // 预加载图片
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = reject
          img.src = url
        } else if (url.match(/\.(js|css)$/i)) {
          // 预加载脚本和样式
          const link = document.createElement("link")
          link.rel = "preload"
          link.href = url
          link.as = url.endsWith(".js") ? "script" : "style"
          link.onload = () => resolve()
          link.onerror = reject
          document.head.appendChild(link)
        } else {
          // 其他资源使用fetch预加载
          fetch(url)
            .then(() => resolve())
            .catch(reject)
        }
      })
    }

    const preloadAll = async () => {
      try {
        await Promise.all(resources.map(preloadResource))
        onComplete?.()
      } catch (error) {
        onComplete?.()
      }
    }

    if (resources.length > 0) {
      preloadAll()
    }
  }, [resources, onComplete])

  return null
}
