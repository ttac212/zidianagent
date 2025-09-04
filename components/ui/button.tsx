import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border-0 relative will-change-transform",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:-translate-y-[1px] hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:shadow-xs hover:shadow-primary/15",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:-translate-y-[1px] hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:shadow-xs focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 hover:shadow-destructive/15",
        outline:
          "border bg-background shadow-xs hover:bg-black/10 hover:-translate-y-[1px] hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:shadow-xs dark:border-transparent dark:hover:bg-white/10 hover:shadow-black/10 dark:hover:shadow-white/10",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:-translate-y-[1px] hover:shadow-lg active:translate-y-0 active:scale-[0.98] active:shadow-xs hover:shadow-secondary/15",
        ghost:
          "hover:bg-black/10 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        // 移动设备触摸优化：使用touch代替hover
        "md:hover:translate-y-0 md:active:translate-y-0 touch:hover:translate-y-0",
        // 触摸反馈：移动设备上使用active状态
        "touch:active:bg-primary/10 touch:active:scale-[0.98]",
        // 无障碍支持：尊重用户的运动偏好
        "motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none",
        className
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
