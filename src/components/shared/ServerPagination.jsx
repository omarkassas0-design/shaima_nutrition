import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/useLanguage';

/**
 * Server-side pagination controls.
 * Shows current page, prev/next buttons, and page size selector.
 * Works with the usePaginatedQuery hook.
 */
export default function ServerPagination({
  page,
  setPage,
  nextPage,
  prevPage,
  pageSize,
  setPageSize,
  hasMore,
  hasPrev,
  isLoading,
}) {
  const { isRTL } = useLanguage();
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const FirstIcon = isRTL ? ChevronsRight : ChevronsLeft;
  const LastIcon = isRTL ? ChevronsLeft : ChevronsRight;

  return (
    <div className="flex items-center justify-between gap-2 pt-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Page</span>
        <span className="text-sm font-semibold tabular-nums">{page + 1}</span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">
          {hasMore ? `${page + 2}+` : `${page + 1}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:inline">Per page:</span>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="w-[72px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map(s => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(0)}
            disabled={!hasPrev || isLoading}
          >
            <FirstIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={prevPage}
            disabled={!hasPrev || isLoading}
          >
            <PrevIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={nextPage}
            disabled={!hasMore || isLoading}
          >
            <NextIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}