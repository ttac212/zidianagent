"use client"

import { motion } from 'framer-motion'

/**
 * 全局页面过渡动画模板
 * 自动应用于所有路由切换
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1] // ease-in-out cubic-bezier
      }}
    >
      {children}
    </motion.div>
  )
}
