'use client';

import { useContext, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Car, Search } from 'lucide-react';
import { RoomsContext } from '@/context/rooms-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { openSale } from '@/components/sales/sale-sheet';
import { formatCurrency } from '@/lib/utils';
import {
  checkInsWithoutPlate, dayTimeMaputo, openStays, stayMatchesVehicle, stayRow, staysClosedBetween, staysTotals, type StayRow,
} from '@/lib/stay-report';

/**
 * Relatórios → estadias do período (uma linha por estadia, com a viatura), viaturas no parque agora
 * e check-ins sem matrícula. Tocar numa estadia abre a venda com o detalhe completo.
 */
export function StaysReport({ start, end, showMoney }: { start: Date; end: Date; showMoney: boolean }) {
  const rooms = useContext(RoomsContext);
  const stays = rooms?.stays;
  const [q, setQ] = useState('');

  const closed = useMemo(() => staysClosedBetween(stays || [], start, end), [stays, start, end]);
  const parked = useMemo(() => openStays(stays || []).map(stayRow), [stays]);
  const noPlate = useMemo(() => checkInsWithoutPlate(stays || [], start, end), [stays, start, end]);
  const rows = useMemo(() => {
    const list = q.trim() ? closed.filter((s) => stayMatchesVehicle(s, q) || String(s.roomName || '').toLowerCase().includes(q.trim().toLowerCase())) : closed;
    return list.map(stayRow);
  }, [closed, q]);
  const totals = useMemo(() => staysTotals(closed.map(stayRow)), [closed]);

  // empresa sem quartos (ou sem permissão para os ver): não mostra nada
  if (!stays || (stays.length === 0 && (rooms?.rooms || []).length === 0)) return null;

  const open = (r: StayRow) => { if (r.saleId) openSale(r.saleId); };

  return (
    <Card data-testid="stays-report">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" /> Estadias e viaturas</CardTitle>
        <CardDescription>
          {totals.count} estadia{totals.count === 1 ? '' : 's'} fechada{totals.count === 1 ? '' : 's'} no período
          {showMoney && totals.count > 0 ? ` · Quartos ${formatCurrency(totals.rooms)} · Bar ${formatCurrency(totals.bar)}${totals.discount ? ` · Descontos ${formatCurrency(totals.discount)}` : ''} · Total ${formatCurrency(totals.total)}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Car className="h-4 w-4 text-sky-600" /> Viaturas no parque agora ({parked.length})</p>
          {parked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum quarto ocupado neste momento.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {parked.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <b>{r.room}</b> · {r.vehicle ? <span className="font-semibold text-sky-700 dark:text-sky-300">{r.vehicle}</span> : <span className="text-amber-700 dark:text-amber-400">sem viatura registada</span>}
                    <span className="block text-xs text-muted-foreground">{r.client}{r.checkInBy ? ` · check-in por ${r.checkInBy}` : ''}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">entrou {dayTimeMaputo(r.checkIn)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {noPlate.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {noPlate.length} check-in{noPlate.length === 1 ? '' : 's'} no período sem matrícula registada ({noPlate.map((s) => s.roomName || 'Quarto').join(', ')}).
          </p>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Estadias do período</p>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula, carro ou quarto" className="h-9 pl-8" />
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? 'Nenhuma estadia com essa pesquisa.' : 'Nenhuma estadia fechada neste período.'}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarto</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Viatura</TableHead>
                      <TableHead>Hóspede</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      {showMoney && <TableHead className="text-right">Quarto</TableHead>}
                      {showMoney && <TableHead className="text-right">Bar</TableHead>}
                      {showMoney && <TableHead className="text-right">Total</TableHead>}
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Atendido por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className={r.saleId ? 'cursor-pointer' : ''} onClick={() => open(r)}>
                        <TableCell className="font-medium">{r.room}</TableCell>
                        <TableCell className="whitespace-nowrap">{dayTimeMaputo(r.checkIn)}</TableCell>
                        <TableCell className="whitespace-nowrap">{dayTimeMaputo(r.checkOut)}</TableCell>
                        <TableCell className={r.vehicle ? 'font-semibold' : 'text-amber-700 dark:text-amber-400'}>{r.vehicle || 'sem viatura'}</TableCell>
                        <TableCell>{r.client}</TableCell>
                        <TableCell className="text-right">{r.billedHours || r.contractedHours}h{r.package ? ` (${r.package})` : ''}</TableCell>
                        {showMoney && <TableCell className="text-right tabular-nums">{formatCurrency(r.roomAmount)}</TableCell>}
                        {showMoney && <TableCell className="text-right tabular-nums">{formatCurrency(r.consumptionsAmount)}</TableCell>}
                        {showMoney && <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.total)}</TableCell>}
                        <TableCell>{r.paymentMethod || '—'}</TableCell>
                        <TableCell className="text-xs">{r.checkInBy || '—'}{r.checkOutBy && r.checkOutBy !== r.checkInBy ? ` / ${r.checkOutBy}` : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-2 md:hidden">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => open(r)} className="w-full rounded-lg border p-3 text-left text-sm">
                      <div className="flex justify-between gap-2">
                        <b>{r.room}</b>
                        {showMoney && <span className="font-semibold tabular-nums">{formatCurrency(r.total)}</span>}
                      </div>
                      <p className={r.vehicle ? 'font-semibold text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-400'}>{r.vehicle || 'sem viatura registada'}</p>
                      <p className="text-xs text-muted-foreground">
                        {dayTimeMaputo(r.checkIn)} → {dayTimeMaputo(r.checkOut)} · {r.billedHours || r.contractedHours}h · {r.client}
                        {showMoney && r.consumptionsAmount > 0 ? ` · bar ${formatCurrency(r.consumptionsAmount)}` : ''}
                        {r.paymentMethod ? ` · ${r.paymentMethod}` : ''}{r.checkInBy ? ` · ${r.checkInBy}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
