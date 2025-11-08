'use client'

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils/cn"

const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden",
      className
    )}
    {...props}
  />
))
Command.displayName = "Command"

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (value: string) => void
  }
>(({ className, onValueChange, ...props }, ref) => {
  return (
    <div className="flex items-center border-b border-border px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 text-dim" />
      <input
        ref={ref}
        onChange={(e) => onValueChange?.(e.target.value)}
        className={cn(
          "flex h-11 w-full bg-transparent py-3 text-sm outline-none",
          "placeholder:text-dim",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
})
CommandInput.displayName = "CommandInput"

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "max-h-[300px] overflow-y-auto overflow-x-hidden",
      className
    )}
    {...props}
  />
))
CommandList.displayName = "CommandList"

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("py-6 text-center text-sm", className)}
    {...props}
  />
))
CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-fg",
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = "CommandGroup"

const CommandItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    onSelect?: (value: string) => void
    value?: string
  }
>(({ className, onSelect, value, ...props }, ref) => {
  return (
    <div
      ref={ref}
      onClick={() => value && onSelect?.(value)}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  )
})
CommandItem.displayName = "CommandItem"

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
}
