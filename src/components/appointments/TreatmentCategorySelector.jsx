import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight, ChevronLeft, Folder, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/useLanguage';

export default function TreatmentCategorySelector({
  open,
  onOpenChange,
  treatments,
  selectedTreatmentId,
  onSelect,
}) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');

  // Derive categories dynamically from the treatment catalog (category field)
  const categories = useMemo(() => {
    const set = new Set();
    (treatments || []).forEach(tr => {
      if (tr.category && String(tr.category).trim()) set.add(String(tr.category).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [treatments]);

  const treatmentsInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return (treatments || [])
      .filter(tr => String(tr.category || '').trim() === selectedCategory)
      .filter(tr => !search || tr.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [treatments, selectedCategory, search]);

  const handleClose = () => {
    setSelectedCategory(null);
    setSearch('');
    onOpenChange(false);
  };

  const handleSelect = (tr) => {
    onSelect(tr);
    setSelectedCategory(null);
    setSearch('');
    onOpenChange(false);
  };

  const selectedTreatment = (treatments || []).find(tr => tr.id === selectedTreatmentId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedCategory ? (
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <Folder className="w-4 h-4 text-primary" />
                <span className="truncate">{selectedCategory}</span>
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 text-primary" />
                {t('treatment_type') || 'Treatment Type'}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {selectedTreatment && !selectedCategory && (
          <div className="text-xs text-muted-foreground -mt-1 mb-1">
            Current: <span className="font-medium text-foreground">{selectedTreatment.name}</span>
          </div>
        )}

        {!selectedCategory ? (
          /* Level 1 — categories */
          <div
            className="space-y-1 max-h-[50vh] overflow-y-auto overscroll-contain"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {categories.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {t('no_treatments_catalog') || 'No treatments found in the catalog.'}
              </div>
            ) : (
              categories.map(cat => {
                const count = (treatments || []).filter(tr => String(tr.category || '').trim() === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors border border-transparent hover:border-border"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-primary" />
                      </span>
                      <span className="font-medium text-sm truncate">{cat}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{count}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Level 2 — treatments in selected category */
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search treatments..."
                className="pl-8"
              />
            </div>
            <div
              className="space-y-1 max-h-[44vh] overflow-y-auto overscroll-contain"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
            >
              {treatmentsInCategory.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search ? 'No matching treatments.' : 'No treatments in this category.'}
                </div>
              ) : (
                treatmentsInCategory.map(tr => (
                  <button
                    key={tr.id}
                    onClick={() => handleSelect(tr)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors border ${
                      tr.id === selectedTreatmentId
                        ? 'bg-primary/10 border-primary'
                        : 'border-transparent hover:bg-muted hover:border-border'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      tr.id === selectedTreatmentId ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{tr.name}</p>
                      {tr.default_price != null && (
                        <p className="text-xs text-muted-foreground">{tr.default_price} {tr.currency || ''}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}