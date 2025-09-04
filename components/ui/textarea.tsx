import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border bg-black/5 dark:bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-foreground/70 focus-visible:ring-2 ring-primary ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
