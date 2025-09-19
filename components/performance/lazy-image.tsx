"use client"

import { useState, useRef, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({ src, alt, width, height, className = "", placeholder, onLoad, onError }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {!isLoaded && !hasError && <Skeleton className="absolute inset-0 w-full h-full" style={{ width, height }} />}

      {isInView && !hasError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src || "/placeholder.svg"}
          alt={alt}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {hasError && (
        <div
          className="flex items-center justify-center bg-muted text-muted-foreground text-sm"
          style={{ width, height }}
        >
          {placeholder || "图片加载失败"}
        </div>
      )}
    </div>
  )
}
