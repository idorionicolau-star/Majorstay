
'use client';

// This file is obsolete. All its logic has been merged into 
// src/context/inventory-context.tsx to create a single unified provider
// that also handles auth state and route protection.
// This file can be safely deleted in a future step.

export function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
