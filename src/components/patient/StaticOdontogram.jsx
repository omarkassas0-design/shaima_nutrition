import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatNumber } from '@/lib/currencyUtils';
import { treatmentCountLabel } from '@/lib/pluralize';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import SurfaceSelector from './SurfaceSelector';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getToothImage, getToothStatus, PERMANENT_ROWS, PRIMARY_ROWS } from './toothImageMap';

const STATUS_RING = {
  planned:     'ring-2 ring-blue-400',
  in_progress: 'ring-2 ring-amber-400',
  completed:   'ring-2 ring-green-400',
  none:        '',
};

const STATUS_DOT = {
  planned:     'bg-blue-400',
  in_progress: 'bg-amber-400',
  completed:   'bg-green-400',
  none:        'bg-gray-300',
};

// ─── Single tooth button ─────────────────────────────────────────────────────
function ToothButton({ num, selected, status, locked, onClick }) {
  const { url, flip } = getToothImage(num);
  const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);

  return (
    <div
      className={`flex flex-col items-center select-none ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={() => !locked && onClick(num)}
    >
      {!isUpper && (
        <span className={`text-[10px] sm:text-[11px] xl:text-xs font-bold leading-none mb-0.5 ${selected ? 'text-primary' : 'text-gray-500'}`}>
          {num}
        </span>
      )}
      <div
        className={`relative rounded-md overflow-hidden bg-white transition-colors
          w-4 h-7 sm:w-8 sm:h-12 md:w-9 md:h-14 xl:w-10 xl:h-16
          ${selected ? 'ring-2 ring-primary ring-offset-1' : STATUS_RING[status]}
          ${!locked ? 'hover:ring-2 hover:ring-primary/40' : ''}`}
      >
        <img
          src={url}
          alt={`Tooth ${num}`}
          className="w-full h-full object-contain"
          style={{ transform: flip ? 'rotate(180deg)' : 'none' }}
          draggable={false}
        />
        {selected && <div className="absolute inset-0 bg-primary/15 pointer-events-none" />}
      </div>
      {isUpper && (
        <span className={`text-[10px] sm:text-[11px] xl:text-xs font-bold leading-none mt-0.5 ${selected ? 'text-primary' : 'text-gray-500'}`}>
          {num}
        </span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function StaticOdontogram({ patient, clinic, patientTreatments = [], onSaved }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [dentition, setDentition] = useState('permanent');
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [step, setStep] = useState('select');
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [surfacesByTreatment, setSurfacesByTreatment] = useState({});

  const { data: treatments = [] } = useQuery({
    queryKey: ['treatments', clinic?.id],
    queryFn: () => clinic ? clinicApi.filter('Treatment', { clinic_id: clinic.id, status: 'active' }) : [],
    enabled: !!clinic,
  });

  // Group treatments by category (trim trailing spaces; uncategorized → "Other")
  const categoriesList = useMemo(() => {
    const groups = {};
    treatments.forEach(tr => {
      const cat = (tr.category || '').trim() || t('uncategorized');
      if (!groups[cat]) groups[cat] = 0;
      groups[cat]++;
    });
    return Object.entries(groups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === t('uncategorized')) return 1;
        if (b.name === t('uncategorized')) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [treatments, t]);

  const filteredTreatments = useMemo(() => {
    if (!selectedCategory) return treatments;
    return treatments.filter(tr => {
      const cat = (tr.category || '').trim() || t('uncategorized');
      return cat === selectedCategory;
    });
  }, [treatments, selectedCategory, t]);

  const toothMap = useMemo(() => {
    const map = {};
    patientTreatments.forEach(pt => {
      (pt.tooth_numbers || []).forEach(n => {
        if (!map[n]) map[n] = [];
        map[n].push(pt);
      });
    });
    return map;
  }, [patientTreatments]);

  const rows = dentition === 'permanent' ? PERMANENT_ROWS : PRIMARY_ROWS;
  const sortedSelected = [...selectedTeeth].sort((a, b) => a - b);
  const selectedTreatments = treatments.filter(tr => selectedTreatmentIds.includes(tr.id));

  const toggleTreatment = (id) => {
    setSelectedTreatmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToothClick = (num) => {
    setSelectedTeeth(prev => prev.includes(num) ? prev.filter(t => t !== num) : [...prev, num]);
  };

  const handleTamam = () => {
    if (selectedTeeth.length === 0) return;
    setStep('choose_category');
    setSelectedCategory(null);
  };

  const handleBackToTeeth = () => {
    setStep('select');
    setSelectedTreatmentIds([]);
    setSelectedCategory(null);
  };

  const handleBackToCategories = () => {
    setStep('choose_category');
    setSelectedTreatmentIds([]);
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    setSelectedTreatmentIds([]);
    setStep('choose_treatment');
  };

  const handleReset = () => {
    setSelectedTeeth([]);
    setSelectedTreatmentIds([]);
    setSelectedCategory(null);
    setSurfacesByTreatment({});
    setStep('select');
  };

  const handleProceed = () => {
    const withSurfaces = selectedTreatments.filter(tr => (tr.applicable_surfaces || []).length > 0);
    if (withSurfaces.length > 0) {
      const init = {};
      withSurfaces.forEach(tr => { init[tr.id] = []; });
      setSurfacesByTreatment(init);
      setStep('choose_surfaces');
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    if (selectedTreatmentIds.length === 0 || selectedTeeth.length === 0 || !patient || !clinic) return;
    setSaving(true);
    try {
      const creates = [];
      selectedTreatments.forEach(tr => {
        const surfaces = surfacesByTreatment[tr.id] || [];
        selectedTeeth.forEach(tooth => {
          creates.push(clinicApi.create('PatientTreatment', {
            clinic_id: clinic.id,
            patient_id: patient.id,
            treatment_id: tr.id,
            treatment_name: tr.name,
            description: tr.description || '',
            price: tr.default_price || 0,
            currency: tr.currency || 'USD',
            status: 'planned',
            tooth_numbers: [tooth],
            tooth_surfaces: surfaces.length > 0 ? { [String(tooth)]: surfaces } : {},
            treatment_date: format(new Date(), 'yyyy-MM-dd'),
          }));
        });
      });
      await Promise.all(creates);
      const total = selectedTreatments.length * selectedTeeth.length;
      toast.success(treatmentCountLabel(total, lang));
      handleReset();
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      onSaved?.();
    } catch (e) {
      toast.error('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (teeth) =>
    <div className="flex items-end gap-px">
      {teeth.map(num => (
        <ToothButton
          key={num}
          num={num}
          selected={selectedTeeth.includes(num)}
          status={getToothStatus(toothMap[num])}
          locked={step !== 'select'}
          onClick={handleToothClick}
        />
      ))}
    </div>;

  return (
    <div className="space-y-4">
      {/* Dentition toggle */}
      <div className="flex gap-2 justify-center">
        <button
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            dentition === 'permanent' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          }`}
          onClick={() => setDentition('permanent')}
        >
          {t('permanent_teeth')}
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            dentition === 'primary' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          }`}
          onClick={() => setDentition('primary')}
        >
          {t('primary_teeth')}
        </button>
      </div>

      {/* Odontogram chart — sized to fit all teeth within viewport without scrolling */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="mx-auto flex flex-col items-center gap-0.5 px-1 py-2 bg-white rounded-xl w-fit sm:gap-1 sm:px-4 sm:py-4 sm:shadow-sm">
          <div className="flex items-end gap-px sm:gap-0.5">
            {renderRow(rows.upperRight)}
            <div className="w-px h-7 sm:h-12 md:h-14 xl:h-16 bg-gray-300 mx-px sm:mx-1 self-center" />
            {renderRow(rows.upperLeft)}
          </div>
          <div className="w-full h-px bg-gray-200 my-0.5 sm:my-1.5" />
          <div className="flex items-start gap-px sm:gap-0.5">
            {renderRow(rows.lowerRight)}
            <div className="w-px h-7 sm:h-12 md:h-14 xl:h-16 bg-gray-300 mx-px sm:mx-1 self-center" />
            {renderRow(rows.lowerLeft)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center text-xs sm:text-sm">
        {['planned', 'in_progress', 'completed'].map(key => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${STATUS_DOT[key]}`} />
            <span className="text-muted-foreground">{t(key)}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Tooth Selection */}
      {step === 'select' && (
        <div className="space-y-3 border-t pt-3">
          {selectedTeeth.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{t('selected_teeth')}:</span>
              <div className="flex flex-wrap gap-1">
                {sortedSelected.map(n => (
                  <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
                {t('clear')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {t('click_teeth_hint')}
            </p>
          )}
          <div className="flex justify-center">
            <Button
              className="gradient-primary text-white px-8"
              disabled={selectedTeeth.length === 0}
              onClick={handleTamam}
            >
              <Check className="w-4 h-4 mr-1.5" />
              {t('tamam')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Category Selection */}
      {step === 'choose_category' && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{t('confirmed_teeth')}:</span>
            <div className="flex flex-wrap gap-1">
              {sortedSelected.map(n => (
                <Badge key={n} className="bg-primary text-white text-xs">{n}</Badge>
              ))}
            </div>
          </div>

          <div className="text-sm font-medium">{t('choose_category')}</div>

          {categoriesList.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              {t('no_treatments_catalog')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
              {categoriesList.map(cat => (
                <button
                  key={cat.name}
                  type="button"
                  className="p-3 rounded-xl border-2 border-border bg-white hover:border-primary/30 text-left transition-colors"
                  onClick={() => handleCategorySelect(cat.name)}
                >
                  <p className="text-sm font-medium leading-tight">{cat.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{treatmentCountLabel(cat.count, lang)}</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-start">
            <Button variant="outline" onClick={handleBackToTeeth}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('back')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Treatment Selection */}
      {step === 'choose_treatment' && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{t('confirmed_teeth')}:</span>
            <div className="flex flex-wrap gap-1">
              {sortedSelected.map(n => (
                <Badge key={n} className="bg-primary text-white text-xs">{n}</Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{selectedCategory}</div>
            <span className="text-xs text-muted-foreground">{treatmentCountLabel(filteredTreatments.length, lang)}</span>
          </div>

          {filteredTreatments.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              {t('no_treatments_catalog')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
              {filteredTreatments.map(tr => {
                const checked = selectedTreatmentIds.includes(tr.id);
                return (
                  <button
                    key={tr.id}
                    type="button"
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-white hover:border-primary/30'
                    }`}
                    onClick={() => toggleTreatment(tr.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                        checked ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{tr.name}</p>
                        {tr.default_price > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatNumber(tr.default_price)} {tr.currency}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedTreatments.length > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <p className="text-sm">
                <span className="font-medium">{t('selected_teeth')}:</span> {sortedSelected.join(', ')}
              </p>
              <div className="space-y-1">
                {selectedTreatments.map(tr => (
                  <div key={tr.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Check className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className="truncate">{tr.name}</span>
                    </span>
                    {tr.default_price > 0 && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatNumber((tr.default_price || 0) * selectedTeeth.length)} {tr.currency}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-between">
            <Button variant="outline" onClick={handleBackToCategories}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('back')}
            </Button>
            <Button
              className="gradient-primary text-white px-6"
              disabled={selectedTreatmentIds.length === 0 || saving}
              onClick={handleProceed}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {t('saving')}...</> : t('add_selected_treatments')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Surface Selection — only for treatments with configured surfaces */}
      {step === 'choose_surfaces' && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{t('confirmed_teeth')}:</span>
            <div className="flex flex-wrap gap-1">
              {sortedSelected.map(n => (
                <Badge key={n} className="bg-primary text-white text-xs">{n}</Badge>
              ))}
            </div>
          </div>

          <div className="text-sm font-medium">{t('select_surfaces_for_treatments')}</div>

          {selectedTreatments.filter(tr => (tr.applicable_surfaces || []).length > 0).map(tr => (
            <div key={tr.id} className="p-3 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{tr.name}</span>
              </div>
              <SurfaceSelector
                surfaces={surfacesByTreatment[tr.id] || []}
                onChange={(s) => setSurfacesByTreatment(prev => ({ ...prev, [tr.id]: s }))}
                options={tr.applicable_surfaces}
              />
            </div>
          ))}

          <div className="flex gap-2 justify-between">
            <Button variant="outline" onClick={() => setStep('choose_treatment')}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('back')}
            </Button>
            <Button
              className="gradient-primary text-white px-6"
              disabled={saving || !selectedTreatments.filter(tr => (tr.applicable_surfaces || []).length > 0).every(tr => (surfacesByTreatment[tr.id] || []).length > 0)}
              onClick={handleSave}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {t('saving')}...</> : <><Check className="w-4 h-4 mr-1" />{t('done')}</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}