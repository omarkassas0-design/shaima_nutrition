import React, { useState } from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { Menu, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/layout/ThemeToggle';
import OfflineIndicator from '@/components/layout/OfflineIndicator';
import NotificationBell from '@/components/layout/NotificationBell';
import QuickAddButton from '@/components/quick-add/QuickAddButton';

export default function TopBar({ onMenuClick }) {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const { isManaging } = useSuperAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-30 glass border-b border-border/50 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              {isManaging && (
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">
                  <Shield className="w-3 h-3 mr-1" /> {t('super_admin')}
                </Badge>
              )}
              <h2 className="text-sm font-semibold text-foreground">{clinic?.name || t('app_name')}</h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="order-last basis-full sm:order-none sm:basis-auto flex-1 min-w-0 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="pl-10 rtl:pl-4 rtl:pr-10 bg-secondary/50 border-0 focus-visible:ring-primary/30"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <OfflineIndicator />
          <QuickAddButton />
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}