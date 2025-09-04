import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border bg-black/5 dark:bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-foreground/70 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 ring-primary ring-offset-2 focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
