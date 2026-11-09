import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Number input that lets the user actually TYPE.
 *
 * The previous pattern (`value={number} onChange={e => set(NaN-or-0)}`)
 * coerced every keystroke to a number, so clearing the field snapped back to 0,
 * a decimal point could not be typed ("12.5" became 125) and a lone "-" or "."
 * produced NaN — which then reached the API as null and was rejected (HTTP 400).
 *
 * This component keeps the raw text locally (so partial input is allowed) and
 * reports a parsed number (or '' when empty) to the parent.
 *
 * Props: value (number | '' | null), onChange(number | ''), plus any Input props.
 */
const normalizeDigits = (raw) => String(raw)
  .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  .replace(/[\u066B\u066C]/g, (d) => (d === '\u066B' ? '.' : ''));

const parseText = (raw) => {
  const cleaned = normalizeDigits(raw).trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return '';
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : '';
};

const toText = (value) => (value === null || value === undefined || value === '' ? '' : String(value));

export default function NumberInput({ value, onChange, ...props }) {
  const [text, setText] = useState(() => toText(value));
  const lastEmitted = useRef(value);

  // Keep in sync when the value changes from outside (auto-calculated prices,
  // loading a record for edit) without fighting the user's typing.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (parseText(text) !== value) setText(toText(value));
     
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseText(raw);
    lastEmitted.current = parsed;
    onChange?.(parsed);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={handleChange}
    />
  );
}