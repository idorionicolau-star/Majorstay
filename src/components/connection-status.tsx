
"use client";

import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize state from browser
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      setIsOnline(window.navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false);
      }, 3000); // Simulate sync time
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup function to run when the component unmounts
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  let status: 'online' | 'offline' | 'syncing' = 'online';
  if (!isOnline) {
    status = 'offline';
  } else if (isSyncing) {
    status = 'syncing';
  }

  const statusInfo = {
    online: {
      tooltip: 'Online e sincronizado.',
      className: 'bg-emerald-500 animate-pulse-green'
    },
    offline: {
      tooltip: 'A trabalhar offline. As suas alterações estão a ser guardadas localmente.',
      className: 'bg-amber-500'
    },
    syncing: {
      tooltip: 'A sincronizar dados pendentes...',
      className: 'bg-blue-500 animate-pulse-blue'
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 rounded-md">
                <div className={cn("h-2.5 w-2.5 rounded-full transition-colors", statusInfo[status].className)} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusInfo[status].tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
