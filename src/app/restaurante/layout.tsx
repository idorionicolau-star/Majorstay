import type { ReactNode } from 'react';
import { KITCHEN_ENABLED } from '@/lib/features';

export default function RestauranteLayout({ children }: { children: ReactNode }) {
  if (!KITCHEN_ENABLED) {
    return (
      <div className="mx-auto max-w-md p-8 text-center space-y-2">
        <h1 className="text-xl font-bold">Cozinha & Restaurante</h1>
        <p className="text-sm text-muted-foreground">Esta secção está desativada por agora.</p>
      </div>
    );
  }
  return <>{children}</>;
}
