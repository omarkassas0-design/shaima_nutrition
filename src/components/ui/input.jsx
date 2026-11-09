import * as React from "react"

import { cn } from "@/lib/utils"
import DateInput from "@/components/ui/date-input"
import TimeInput from "@/components/ui/time-input"
import MonthInput from "@/components/ui/month-input"

// Date, time and month fields are drawn by the browser in the DEVICE's language
// and order, which can never match the selected app language. They are routed to
// app-controlled fields with the same value/onChange contract, so every existing
// <Input type="date|time|month"> in the app is fixed centrally.
const CUSTOM_FIELDS = { date: DateInput, time: TimeInput, month: MonthInput }

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const Custom = CUSTOM_FIELDS[type]
  if (Custom) {
    return <Custom ref={ref} className={className} {...props} />
  }
  return (
    (<input
      type={type}
      className={cn(
        "flex h-11 min-w-0 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }