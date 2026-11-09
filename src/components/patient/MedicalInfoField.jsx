import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * A single medical-info field. Defined at module level (NOT inside the parent
 * render body) so React keeps the same element identity between keystrokes —
 * otherwise the input remounts on every character and loses focus.
 */
export default function MedicalInfoField({ label, field, area, editing, formObj, setFormObj }) {
  const value = formObj[field] || '';
  const handleChange = (e) => setFormObj({ ...formObj, [field]: e.target.value });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {editing ? (
        area ? (
          <Textarea value={value} onChange={handleChange} rows={2} className="text-sm" />
        ) : (
          <Input value={value} onChange={handleChange} className="text-sm" />
        )
      ) : (
        <p className="text-sm bg-secondary/50 rounded-lg px-3 py-2 min-h-[36px] whitespace-pre-wrap">{value || '-'}</p>
      )}
    </div>
  );
}