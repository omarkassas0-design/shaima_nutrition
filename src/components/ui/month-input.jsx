import * as React from "react";
import { useLanguage } from "@/lib/useLanguage";
import { getLocale } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

const selectClass =
  "h-full min-w-0 cursor-pointer appearance-none bg-transparent text-base focus-visible:outline-none disabled:cursor-not-allowed md:text-sm";

/**
 * App-controlled month field. A native <input type="month"> shows device-language
 * month names. This lists the month names in the selected app language (from
 * Intl) next to a year picker.
 *
 * Drop-in for the native input: `value` is "yyyy-MM" and `onChange` receives
 * `{ target: { value, name } }`.
 */
const MonthInput = React.forwardRef(({ className, value, onChange, disabled, name, ...rest }, ref) => {
  const { lang } = useLanguage();
  const now = new Date();
  const [y, m] = String(value || "").split("-").map(Number);
  const year = y || now.getFullYear();
  const month = m || now.getMonth() + 1;

  const monthName = new Intl.DateTimeFormat(getLocale(lang), { month: "long" });
  const first = Math.min(year, now.getFullYear()) - 5;
  const last = Math.max(year, now.getFullYear()) + 1;
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  const emit = (nextYear, nextMonth) =>
    onChange?.({ target: { value: `${nextYear}-${String(nextMonth).padStart(2, "0")}`, name } });

  return (
    <div
      className={cn(
        "flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50",
        className
      )}
    >
      <select ref={ref} disabled={disabled} value={month} onChange={(e) => emit(year, Number(e.target.value))} className={cn(selectClass, "flex-1")} {...rest}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{monthName.format(new Date(2026, i, 1, 12))}</option>
        ))}
      </select>
      <select disabled={disabled} value={year} onChange={(e) => emit(Number(e.target.value), month)} className={cn(selectClass, "bidi-iso")}>
        {years.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
});
MonthInput.displayName = "MonthInput";

export default MonthInput;