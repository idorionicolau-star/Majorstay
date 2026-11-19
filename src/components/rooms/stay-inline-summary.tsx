'use client';

import { useContext } from 'react';
import { Car } from 'lucide-react';
import { RoomsContext } from '@/context/rooms-context';
import { formatCurrency } from '@/lib/utils';
import { hhmmMaputo, stayForSale, stayRow } from '@/lib/stay-report';

/** Resumo da estadia numa linha do Histórico: viatura, entrada → saída, horas e bar — sem precisar de abrir a venda. */
export function StayInlineSummary({ sale, className }: { sale: { id: string; stayId?: string; productName?: string }; className?: string }) {
  const rooms = useContext(RoomsContext);
  if (!sale.productName?.startsWith('Estadia:') && !sale.stayId) return null;
  const stay = stayForSale(sale, rooms?.stays || []);
  if (!stay) return null;
  const r = stayRow(stay);
  return (
    <div className={className}>
      <p className={`flex items-center gap-1 font-semibold ${r.vehicle ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-400'}`}>
        <Car className="h-3 w-3 shrink-0" /> <span className="truncate">{r.vehicle || 'Sem viatura registada'}</span>
      </p>
      <p className="text-muted-foreground">
        {hhmmMaputo(r.checkIn)} → {r.open ? '…' : hhmmMaputo(r.checkOut)}
        {r.billedHours ? ` · ${r.billedHours}h` : ''}
        {r.consumptionsAmount > 0 ? ` · bar ${formatCurrency(r.consumptionsAmount)}` : ''}
        {r.checkInBy ? ` · ${r.checkInBy}` : ''}
      </p>
    </div>
  );
}
