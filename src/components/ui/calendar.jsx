import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { ar } from "date-fns/locale/ar"
import { tr } from "date-fns/locale/tr"
import { enGB } from "date-fns/locale/en-GB"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { useLanguage } from "@/lib/useLanguage"
import { formatMonthYear, formatWeekday } from "@/lib/dateFormat"

const DATE_FNS_LOCALES = { en: enGB, ar, tr };

// Arabic weekday names come back as full words ("الاثنين"), too wide for a
// calendar column. The conventional short form simply drops the article.
function weekdayLabel(day, lang) {
  const name = formatWeekday(day, lang, "short");
  return lang === "ar" ? name.replace(/^ال/, "") : name;
}

/**
 * Language-aware calendar. Month/weekday names come from the shared Intl date
 * formatter (so they match every other date in the app), the layout follows the
 * document direction, and the week starts on Saturday like the appointments
 * calendar.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  const { lang, isRTL } = useLanguage();

  return (
    (<DayPicker
      showOutsideDays={showOutsideDays}
      dir={isRTL ? "rtl" : "ltr"}
      locale={DATE_FNS_LOCALES[lang] || enGB}
      weekStartsOn={6}
      formatters={{
        formatCaption: (month) => formatMonthYear(month, lang),
        formatWeekdayName: (day) => weekdayLabel(day, lang),
        formatDay: (day) => String(day.getDate()),
      }}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: isRTL ? "absolute right-1" : "absolute left-1",
        nav_button_next: isRTL ? "absolute left-1" : "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-10 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props} />)
  );
}
Calendar.displayName = "Calendar"

export { Calendar }