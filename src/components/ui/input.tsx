
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, defaultValue, placeholder, ...props }, ref) => {
    // Numeric fields must not show a "0" the user has to delete first.
    // A value of 0 is kept (nothing changes in the form) but shown as an empty field with "0" as hint.
    const isNumeric = type === "number" || props.inputMode === "decimal" || props.inputMode === "numeric";
    const isZero = (v: unknown) => v === 0 || v === "0";
    const hideValue = isNumeric && isZero(value);
    const hideDefault = isNumeric && isZero(defaultValue);
    return (
      <input
        type={type}
        {...(value !== undefined ? { value: hideValue ? "" : value } : {})}
        {...(defaultValue !== undefined ? { defaultValue: hideDefault ? "" : defaultValue } : {})}
        placeholder={placeholder ?? (hideValue || hideDefault ? "0" : undefined)}
        className={cn(
          "flex h-10 sm:h-12 w-full rounded-xl sm:rounded-2xl border border-input bg-transparent px-4 sm:px-5 py-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
