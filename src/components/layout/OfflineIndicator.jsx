import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingCount, getFailedCount, syncQueue, clearFailedItems } from '@/lib/offlineQueue';
import { appClient } from '@/api/appClient';
import { useQueryClient } from '@tanstack/react-query';
import { Wifi, WifiOff, RefreshCw, CloudUpload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Shows the current connection + sync status in the TopBar.
 * - Online + no pending → green wifi (subtle)
 * - Online + pending → "Syncing N…" button (click to sync now)
 * - Offline → red "Offline" badge with pending count
 * - Failed items → amber alert with retry option
 */
export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCounts = () => {
    setPending(getPendingCount());
    setFailed(getFailedCount());
  };

  useEffect(() => {
    refreshCounts();
    const handler = () => refreshCounts();
    window.addEventListener('offline-queue-changed', handler);
    return () => window.removeEventListener('offline-queue-changed', handler);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pending > 0 && !syncing) {
      handleSync();
    }
  }, [isOnline]);  

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncQueue(appClient, queryClient);
      refreshCounts();
      if (result.synced > 0) {
        toast.success(`${result.synced} record(s) synced to server`);
      }
      if (result.conflicts > 0) {
        toast.warning(`${result.conflicts} conflict(s) skipped — server has newer data`);
      }
      if (result.failed > 0 && result.synced === 0) {
        toast.error('Sync failed — will retry automatically');
      }
    } catch (e) {
      toast.error('Sync failed: ' + (e?.message || 'Unknown'));
    } finally {
      setSyncing(false);
    }
  }

  // Offline with pending
  if (!isOnline && pending > 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Offline</span>
        <span className="px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800">{pending}</span>
      </div>
    );
  }

  // Offline, no pending
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    );
  }

  // Online, syncing
  if (syncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Syncing…</span>
      </div>
    );
  }

  // Online, failed items
  if (failed > 0) {
    return (
      <button
        onClick={() => { clearFailedItems(); refreshCounts(); toast.info('Failed items cleared'); }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors"
        title="Some items failed to sync. Click to discard."
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{failed} failed</span>
      </button>
    );
  }

  // Online, pending (ready to sync)
  if (pending > 0) {
    return (
      <button
        onClick={handleSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs font-medium hover:bg-sky-200 dark:hover:bg-sky-800/40 transition-colors"
      >
        <CloudUpload className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sync {pending}</span>
      </button>
    );
  }

  // Online, all synced — subtle indicator
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs">
      <Wifi className="w-3.5 h-3.5" />
    </div>
  );
}
