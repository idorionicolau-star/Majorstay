'use client';

import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseProvider } from '@/firebase/provider';
import { InventoryProvider } from '@/context/inventory-context';
import { CRMProvider } from '@/context/crm-context';
import { FinanceProvider } from '@/context/finance-context';
import { ClientLayout } from '@/components/layout/client-layout';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FirebaseProvider>
        <InventoryProvider>
          <CRMProvider>
            <FinanceProvider>
              <FirebaseErrorListener />
              <ClientLayout>{children}</ClientLayout>
            </FinanceProvider>
          </CRMProvider>
        </InventoryProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}
