import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/lib/useLanguage";
import { formatDisplayDate, parseDateValue, toISODate } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

/**
 * App-controlled date field. A native <input type="date"> is drawn by the
 * browser/OS in the DEVICE's language and order (mm/dd/yyyy, device month
 * names, device digits) and cannot be styled or localised by the app, so the
 * field never matched the selected app language. This one shows the value with
 * the shared date formatter and opens the language-aware Calendar.
 *
 * Drop-in for the native input: `value` is an ISO "yyyy-mm-dd" string and
 * `onChange` receives `{ target: { value, name } }`.
 */
const DateInput = React.forwardRef(
  ({ className, value, onChange, disabled, min, max, placeholder, name, ...rest }, ref) => {
    const { lang, t } = useLanguage();
    const [open, setOpen] = React.useState(false);
    const selected = parseDateValue(value) || undefined;

    const limits = [
      min && { before: parseDateValue(min) },
      max && { after: parseDateValue(max) },
    ].filter(Boolean);

    const pick = (date) => {
      if (!date) return;
      onChange?.({ target: { value: toISODate(date), name } });
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-11 min-w-0 w-full items-center justify-between gap-2 rounded-xl border border-input bg-transparent px-3 py-1 text-start text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
            {...rest}
          >
            <span className={cn("bidi-iso", !selected && "text-muted-foreground")}>
              {selected ? formatDisplayDate(selected, lang) : (placeholder || t("select_date"))}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={pick}
            disabled={limits.length ? limits : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DateInput.displayName = "DateInput";

export default DateInput;