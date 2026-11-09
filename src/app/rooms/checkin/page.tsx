import React, { Suspense } from 'react';
import { CheckInView } from '@/components/rooms/check-in-view';

export const metadata = {
  title: 'Nova Entrada de Hóspede — MajorStay Hospitality',
  description: 'Check-in rápido de balcão com alocação imediata de chave física e abertura de ficha no MajorStay.',
};

export default function CheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-stone-500">
          <div className="animate-pulse text-sm font-semibold">Carregando balcão de check-in...</div>
        </div>
      }
    >
      <CheckInView />
    </Suspense>
  );
}
