import React, { useState } from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { Plus } from 'lucide-react';

export const TOOTH_SURFACES = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'palatal'];

export const SURFACE_ABBR = {
  mesial: 'M',
  distal: 'D',
  occlusal: 'O',
  buccal: 'B',
  lingual: 'L',
  palatal: 'P',
};

export function formatSurfaces(toothSurfaces, toothNumber, t) {
  if (!toothSurfaces || !toothNumber) return '';
  const key = String(toothNumber);
  const surfaces = toothSurfaces[key];
  if (!surfaces || surfaces.length === 0) return '';
  return surfaces.map(s => (t(s) || s)).join(', ');
}

export default function SurfaceSelector({ surfaces = [], onChange, options, allowCustom = false }) {
  const { t } = useLanguage();
  const [customName, setCustomName] = useState('');

  // Display: provided options (or standard), plus any already-selected custom surfaces
  const baseOptions = options && options.length > 0 ? options : TOOTH_SURFACES;
  const allOptions = Array.from(new Set([...baseOptions, ...surfaces]));

  const toggle = (surface) => {
    if (surfaces.includes(surface)) {
      onChange(surfaces.filter(s => s !== surface));
    } else {
      onChange([...surfaces, surface]);
    }
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    if (!surfaces.includes(name)) onChange([...surfaces, name]);
    setCustomName('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {allOptions.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all
              ${surfaces.includes(s)
                ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                : 'bg-background border-border text-muted-foreground hover:border-accent/50'}`}
          >
            {t(s) || s}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder={t('custom_surface_placeholder')}
            className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-2.5 h-8 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />{t('add')}
          </button>
        </div>
      )}
    </div>
  );
}