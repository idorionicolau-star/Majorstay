

"use client";

import { useState, useMemo, useContext, useEffect } from "react";
import { useInventoryBackHref } from "@/hooks/use-inventory-back";
import { useSearchParams } from "next/navigation";
import { InventoryContext } from "@/context/inventory-context";
import { ProductsTabs } from "@/components/inventory/products-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockMovement } from "@/lib/types";
import { useFirestore } from '@/firebase/provider';
import { useFirestorePagination } from '@/hooks/use-firestore-pagination';
import { collection, query, orderBy, Timestamp, where, QueryConstraint, limit } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { startOfDay, endOfDay, isWithinInterval, format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MovementCard } from "@/components/inventory/history/movement-card";
import Link from "next/link";

export default function InventoryHistoryPage() {
  const backHref = useInventoryBackHref();
  const searchParams = useSearchParams();
  const productNameFromQuery = searchParams.get('productName');

  const { companyId, locations, loading: contextLoading, user, companyData } = useContext(InventoryContext) || {};
  const firestore = useFirestore();
  const { toast } = useToast();


  const [searchFilter, setSearchFilter] = useState(productNameFromQuery || "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const stockMovementsCollectionRef = useMemo(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, `companies/${companyId}/stockMovements`);
  }, [firestore, companyId]);

  // Use pagination hook with high limit to mimic "infinite list" but safely
  // We can add server-side sorting here if needed, but for now we keep client-side sort logic
  // to minimize changes, BUT we must fetch a reasonable amount to sort.
  // actually, for correct sorting we should sort in Firestore.
  // The current logic sorts by timestamp desc.

  const queryConstraints = useMemo(() => {
    const constraints: QueryConstraint[] = [];
    if (selectedDate) {
      // Note: Firestore filtering by date range AND other fields might require composite indexes.
      // Keeping it client-side for now implies we need to fetch MOST/ALL data if possible,
      // OR we move to server-side filtering.
      // User complained about "loop", likely due to mutation or crash.
      // Let's stick to cleaning up the existing logic first + mutation fix,
      // BUT using pagination to prevent 10k items crash.
      // We'll fetch ordered by timestamp desc to get latest first.
      constraints.push(orderBy('timestamp', 'desc'));
    } else {
      constraints.push(orderBy('timestamp', 'desc'));
    }
    return constraints;
  }, [selectedDate]);

  const { data: movements, loading: movementsLoading, loadMore, hasMore } = useFirestorePagination<StockMovement>(
    stockMovementsCollectionRef as any,
    2000,
    queryConstraints
  );

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations?.forEach(loc => map.set(loc.id, loc.name));
    return map;
  }, [locations]);

  const filteredMovements = useMemo(() => {
    if (!movements) return [];
    let result = movements;

    if (selectedDate) {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      result = result.filter(m => {
        if (!m.timestamp) return false;
        const moveDate = (m.timestamp as Timestamp).toDate();
        return isWithinInterval(moveDate, { start, end });
      });
    }

    if (searchFilter) {
      const lowerCaseFilter = searchFilter.toLowerCase();
      result = result.filter(m =>
        m.productName.toLowerCase().includes(lowerCaseFilter) ||
        (m.userName && m.userName.toLowerCase().includes(lowerCaseFilter)) ||
        m.reason.toLowerCase().includes(lowerCaseFilter)
      );
    }

    // Sort client-side (Create a copy using toSorted or spread to avoid mutation!)
    return [...result].sort((a, b) => { // Fix: spread to create copy before sort
      const dateA = a.timestamp ? (a.timestamp as Timestamp).toMillis() : 0;
      const dateB = b.timestamp ? (b.timestamp as Timestamp).toMillis() : 0;
      return dateB - dateA;
    });
  }, [movements, searchFilter, selectedDate]);

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório de Movimentos de Stock</title>');
      printWindow.document.write(`
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
        `);
      printWindow.document.write(`
            <style>
                body { font-family: 'PT Sans', sans-serif; line-height: 1.6; color: #333; margin: 2rem; }
                .container { max-width: 1000px; margin: auto; padding: 2rem; border: 1px solid #eee; border-radius: 8px; }
                .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; }
                .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 2rem; color: #3498db; margin: 0; }
                .logo { display: flex; flex-direction: column; align-items: flex-start; }
                .logo span { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: bold; color: #3498db; }
                table { width: 100%; border-collapse: collapse; margin-top: 2rem; font-size: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f9fafb; font-family: 'Space Grotesk', sans-serif; }
                .footer { text-align: center; margin-top: 3rem; font-size: 0.8rem; color: #999; }
                @page { size: A4 landscape; margin: 0.5in; }
                @media print {
                  body { margin: 0; -webkit-print-color-adjust: exact; }
                  .no-print { display: none; }
                  .container { border: none; box-shadow: none; }
                }
            </style>
        `);
      printWindow.document.write('</head><body><div class="container">');
      printWindow.document.write(`
            <div class="header">
                 <div class="logo">
                    <span>${companyData?.name || 'MajorStockX'}</span>
                </div>
                <h1>Relatório de Movimentos</h1>
            </div>
            <h2>Período: ${selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Todos os movimentos'}</h2>
        `);

      printWindow.document.write('<table><thead><tr><th>Data e Hora</th><th>Tipo</th><th>Produto</th><th>Qtd.</th><th>Localização</th><th>Motivo</th><th>Utilizador</th></tr></thead><tbody>');

      filteredMovements.forEach(movement => {
        const timestamp = movement.timestamp as Timestamp;
        const date = timestamp ? format(timestamp.toDate(), "dd/MM/yyyy HH:mm:ss") : 'N/A';
        const locationFrom = movement.fromLocationId ? (locationMap.get(movement.fromLocationId) || 'N/A') : 'N/A';
        const locationTo = movement.toLocationId ? (locationMap.get(movement.toLocationId) || 'N/A') : 'N/A';
        let locationText = '';
        if (movement.type === 'TRANSFER') {
          locationText = `${locationFrom} → ${locationTo}`;
        } else if (movement.type === 'IN') {
          locationText = locationTo;
        } else if (movement.type === 'OUT') {
          locationText = locationFrom;
        }

        printWindow.document.write(`
                <tr>
                    <td>${date}</td>
                    <td>${movement.type}</td>
                    <td>${movement.productName}</td>
                    <td>${movement.quantity > 0 ? '+' : ''}${movement.quantity}</td>
                    <td>${locationText}</td>
                    <td>
                        ${movement.reason}
                        ${movement.isAudit
            ? `<br/><span style="font-size: 0.8em; color: #666;">(Sistema: ${movement.systemCountBefore} &rarr; Físico: ${movement.physicalCount})</span>`
            : ''}
                    </td>
                    <td>${movement.userName}</td>
                </tr>
            `);
      });

      printWindow.document.write('</tbody></table>');

      printWindow.document.write(`<div class="footer"><p>${companyData?.name || 'MajorStockX'} &copy; ' + new Date().getFullYear() + '</p></div>`);
      printWindow.document.write('</div></body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { generateMovementsPDF } = await import('@/lib/pdf-generator');
      const rows = filteredMovements.map(m => {
        const ts = m.timestamp as Timestamp;
        const from = m.fromLocationId ? (locationMap.get(m.fromLocationId) || '') : '';
        const to = m.toLocationId ? (locationMap.get(m.toLocationId) || '') : '';
        const location = m.type === 'TRANSFER' ? `${from} → ${to}` : m.type === 'IN' ? to : m.type === 'OUT' ? from : (from || to);
        const reason = m.isAudit ? `${m.reason} (sistema ${m.systemCountBefore} → contado ${m.physicalCount})` : m.reason;
        return {
          date: ts ? format(ts.toDate(), 'dd/MM/yyyy HH:mm') : '',
          type: m.type,
          product: m.productName,
          quantity: m.quantity,
          location: location.replace('→', '->'),
          reason: reason.replace('→', '->'),
          user: m.userName || '',
        };
      });
      generateMovementsPDF(rows, companyData || null, selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Todos os movimentos');
      toast({ title: 'PDF descarregado', description: `${rows.length} movimento${rows.length === 1 ? '' : 's'}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível gerar o PDF', description: e?.message || 'Tente de novo.' });
    }
  };


  const isLoading = contextLoading || movementsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
        <ProductsTabs />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button onClick={handleDownloadPdf} variant="outline" className="h-12">
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
            <Button onClick={handlePrint} variant="outline" className="h-12">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2" data-tour="hist-filters">
          <Input
            placeholder="Pesquisar por produto, utilizador, motivo..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-12 text-sm"
          />
          <DatePicker date={selectedDate} setDate={setSelectedDate} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-tour="hist-list">
          {filteredMovements.length > 0 ? (
            filteredMovements.map(movement => (
              <MovementCard key={movement.id} movement={movement} locationMap={locationMap} />
            ))
          ) : (
            !movementsLoading && (
              <div className="col-span-full">
                <Card className="text-center py-12 text-muted-foreground">
                  Nenhum movimento encontrado com os filtros atuais.
                </Card>
              </div>
            )
          )}
        </div>

        {/* Load More Button if needed */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" onClick={loadMore} disabled={movementsLoading}>
              {movementsLoading ? "A carregar..." : "Carregar Mais Histórico"}
            </Button>
          </div>
        )}

      </div>
    </>
  );
}
