import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] active:translate-y-0.5 active:shadow-none disabled:active:scale-100 disabled:active:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-indigo-300 bg-indigo-100 text-indigo-950 shadow-sm hover:bg-indigo-200 hover:text-indigo-950 dark:border-indigo-500 dark:bg-indigo-200 dark:text-indigo-950 dark:hover:bg-indigo-300",
        secondary:
          "border border-violet-300 bg-violet-100 text-violet-950 shadow-sm hover:bg-violet-200 dark:border-violet-400 dark:bg-violet-200 dark:text-violet-950 dark:hover:bg-violet-300",
        ghost: "border border-indigo-200 bg-indigo-50 text-indigo-950 hover:bg-indigo-100 hover:text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-50 dark:hover:bg-indigo-900",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
