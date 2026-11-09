import * as React from "react";
import { cn } from "@/lib/utils";

const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

const selectClass =
  "h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-center text-base focus-visible:outline-none disabled:cursor-not-allowed md:text-sm";

/**
 * App-controlled 24-hour time field. A native <input type="time"> follows the
 * device's 12/24-hour setting, digit set and AM/PM text. This always shows
 * HH:MM with plain 0-9 digits, left-to-right (a time is a numeric unit even
 * inside Arabic text).
 *
 * Drop-in for the native input: `value` is "HH:MM" and `onChange` receives
 * `{ target: { value, name } }`.
 */
const TimeInput = React.forwardRef(({ className, value, onChange, disabled, name, ...rest }, ref) => {
  const [rawH = "", rawM = ""] = String(value || "").split(":");
  const h = rawH === "" ? "" : pad(parseInt(rawH, 10) || 0);
  const m = rawM === "" ? "" : pad(parseInt(rawM, 10) || 0);

  const emit = (nextH, nextM) => {
    const result = nextH === "" && nextM === "" ? "" : `${nextH || "00"}:${nextM || "00"}`;
    onChange?.({ target: { value: result, name } });
  };

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-xl border border-input bg-transparent px-2 shadow-sm focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50",
        className
      )}
    >
      <select ref={ref} disabled={disabled} value={h} onChange={(e) => emit(e.target.value, m)} className={selectClass} {...rest}>
        <option value="">--</option>
        {HOURS.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-muted-foreground">:</span>
      <select disabled={disabled} value={m} onChange={(e) => emit(h, e.target.value)} className={selectClass}>
        <option value="">--</option>
        {MINUTES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
});
TimeInput.displayName = "TimeInput";

export default TimeInput;