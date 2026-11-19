'use client';

import { BedDouble, Car, Clock, CreditCard, FileText, Phone, User, UserCheck, XCircle } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { dayTimeMaputo, stayRow, toDate } from '@/lib/stay-report';

const hrs = (n: number) => `${n}h`;

/** Tudo sobre uma estadia, para a ficha da venda (Histórico de Transações) e os Relatórios. */
export function StayDetails({ stay }: { stay: Stay }) {
  const r = stayRow(stay);
  const removed = stay.removedConsumptions || [];
  return (
    <div className="space-y-3 text-sm" data-testid="stay-details">
      <div className="flex items-start gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/40">
        <Car className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Viatura</p>
          {r.hasVehicle || r.vehicle
            ? <p className="break-words text-base font-bold">{r.vehicle}</p>
            : <p className="font-semibold text-amber-700 dark:text-amber-400">Sem viatura registada</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Item icon={BedDouble} label="Quarto" value={r.room} />
        <Item icon={User} label="Hóspede" value={r.client} />
        {stay.clientPhone && <Item icon={Phone} label="Telefone" value={stay.clientPhone} />}
        {stay.clientDoc && <Item icon={FileText} label="BI / Passaporte" value={stay.clientDoc} />}
        <Item icon={Clock} label="Entrada" value={dayTimeMaputo(r.checkIn)} />
        <Item icon={Clock} label="Saída" value={r.open ? 'Ainda no quarto' : dayTimeMaputo(r.checkOut)} />
        <Item icon={Clock} label="Horas" value={`${r.package ? `${r.package} · ` : ''}contratadas ${hrs(r.contractedHours)}${r.extensionsCount ? ` (${r.extensionsCount} prorrogaç${r.extensionsCount === 1 ? 'ão' : 'ões'})` : ''}${r.billedHours ? ` · cobradas ${hrs(r.billedHours)}` : ''}`} />
        <Item icon={CreditCard} label="Pagamento" value={r.paymentMethod || '—'} />
        <Item icon={UserCheck} label="Check-in por" value={r.checkInBy || '—'} />
        {!r.open && <Item icon={UserCheck} label="Check-out por" value={r.checkOutBy || '—'} />}
      </div>

      {(stay.extensions || []).length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Prorrogações</p>
          <ul className="divide-y rounded-lg border">
            {(stay.extensions || []).map((e, i) => (
              <li key={i} className="flex justify-between gap-2 px-3 py-1.5">
                <span>+{e.hours}h{e.addedByName ? ` · ${e.addedByName}` : ''}</span>
                <span className="text-muted-foreground">{dayTimeMaputo(toDate(e.addedAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">Consumos</p>
        {(stay.consumptions || []).length === 0 ? (
          <p className="text-muted-foreground">Sem consumos.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {(stay.consumptions || []).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0">{c.quantity}× {c.productName}<span className="block text-xs text-muted-foreground">{dayTimeMaputo(toDate(c.addedAt))}{c.addedByName ? ` · ${c.addedByName}` : ''}</span></span>
                <span className="shrink-0 tabular-nums">{formatCurrency(Number(c.totalPrice) || c.quantity * c.unitPrice)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {removed.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-rose-600"><XCircle className="h-3.5 w-3.5" /> Consumos anulados</p>
          <ul className="divide-y rounded-lg border border-rose-200 dark:border-rose-900">
            {removed.map((c, i) => (
              <li key={i} className="px-3 py-1.5">
                <div className="flex justify-between gap-2">
                  <span className="line-through">{c.quantity}× {c.productName}</span>
                  <span className="shrink-0 tabular-nums line-through">{formatCurrency((Number(c.quantity) || 0) * (Number(c.unitPrice) || 0))}</span>
                </div>
                <p className="text-xs text-muted-foreground">{c.reason}{c.removedByName ? ` · por ${c.removedByName}` : ''}{c.removedAt ? ` · ${dayTimeMaputo(toDate(c.removedAt))}` : ''}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 rounded-lg bg-muted p-3">
        <Line label="Quarto" value={formatCurrency(r.roomAmount)} />
        <Line label="Bar / consumos" value={formatCurrency(r.consumptionsAmount)} />
        {r.discount > 0 && <Line label={`Desconto${stay.discountReason ? ` (${stay.discountReason}${stay.discountByName ? `, por ${stay.discountByName}` : ''})` : ''}`} value={`- ${formatCurrency(r.discount)}`} />}
        <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatCurrency(r.total)}</span></div>
        {!r.open && <Line label="Pago" value={formatCurrency(r.paid)} />}
      </div>

      {stay.notes && <p className="rounded-md border bg-background p-3">{stay.notes}</p>}
    </div>
  );
}

function Item({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words font-medium">{value}</p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span></div>;
}
