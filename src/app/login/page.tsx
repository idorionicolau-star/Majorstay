'use client';

import React, { Suspense } from 'react';
import { UnifiedAuthCard } from '@/components/auth/unified-auth-card';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] dark:bg-[#150F0C]" />}>
      <UnifiedAuthCard initialTab="login" />
    </Suspense>
  );
}
