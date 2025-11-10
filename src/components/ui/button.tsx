import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-600 shadow-soft hover:shadow-medium font-semibold active:shadow-[0_0_20px_rgba(var(--archvd-accent-rgb),0.4),0_0_40px_rgba(var(--archvd-accent-rgb),0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
        outline: "border border-keyline bg-panel text-fg hover:border-accent/40 hover:bg-soft active:shadow-[0_0_15px_rgba(var(--archvd-accent-rgb),0.3),0_0_30px_rgba(var(--archvd-accent-rgb),0.15)]",
        ghost: "hover:bg-soft text-fg active:shadow-[0_0_12px_rgba(var(--archvd-accent-rgb),0.25)]",
        destructive: "bg-loss text-white hover:bg-loss/90 shadow-soft hover:shadow-medium font-semibold active:shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_40px_rgba(239,68,68,0.25)]",
        secondary: "border border-keyline-strong bg-panel text-fg hover:bg-[#FAF8F5] active:shadow-[0_0_12px_rgba(var(--archvd-accent-rgb),0.2)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
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
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
