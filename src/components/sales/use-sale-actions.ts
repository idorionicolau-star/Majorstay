"use client";

// As ações sobre uma venda já feita (corrigir, levantar, apagar). As mesmas em qualquer sítio: no Histórico de
// Vendas e na ficha da venda que se abre do Financeiro, dos Clientes, dos Relatórios…
import { useContext } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { Sale } from "@/lib/types";
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { changesToUpdate, diffSale, sellerBlockedFields } from "@/lib/sale-audit";
import { formatCurrency } from "@/lib/utils";
import { links } from "@/lib/deep-links";

/** A venda paga por inteiro. Uma venda já levantada continua levantada (senão o levantamento reaparecia e descontava o stock outra vez). */
export const paidInFull = (sale: Sale): Sale => ({
    ...sale,
    amountPaid: sale.totalValue,
    status: sale.status === "Levantado" ? "Levantado" : "Pago",
});

export function useSaleActions() {
    const { toast } = useToast();
    const inventoryContext = useContext(InventoryContext);
    const firestore = useFirestore();
    const user = inventoryContext?.user;
    const companyId = inventoryContext?.companyId;

    const updateSale = async (updatedSale: Sale) => {
        const before = (inventoryContext?.sales || []).find((s: Sale) => s.id === updatedSale.id);
        if (!before || !updatedSale.id || !firestore || !companyId || !user) return;

        // Só o que mudou de facto — e cada mudança fica registada (quem, quando, antes e depois).
        const diff = diffSale(before, updatedSale);
        if (!Object.keys(diff).length) return;

        const isManager = user.role === 'Admin' || user.role === 'Dono';
        const blocked = sellerBlockedFields(diff);
        if (!isManager && blocked.length) {
            toast({ variant: "destructive", title: "Só o gestor pode alterar isto", description: "Produto, quantidade, preço e valores de uma venda já feita só podem ser corrigidos pelo gestor." });
            return;
        }
        // Defesa: mudar produto/quantidade de uma venda que já mexeu no stock deixaria o stock errado.
        if (before.status !== 'Pendente' && (diff.quantity || diff.productName)) {
            toast({ variant: "destructive", title: "Não é possível", description: "Para trocar produto ou quantidade, apague a venda (o stock volta) e faça outra." });
            return;
        }

        // Anti-roubo: alterações a valores de uma venda já feita avisam o gestor.
        if (inventoryContext?.notifyManagers) {
            const changes: string[] = [];
            const fmt = (n: number) => formatCurrency(Number(n) || 0);
            if (diff.quantity) changes.push(`qtd ${before.quantity} → ${updatedSale.quantity}`);
            if (diff.unitPrice) changes.push(`preço ${fmt(before.unitPrice)} → ${fmt(updatedSale.unitPrice)}`);
            if (diff.totalValue) changes.push(`total ${fmt(before.totalValue)} → ${fmt(updatedSale.totalValue)}`);
            if (diff.amountPaid) changes.push(`pago ${fmt(before.amountPaid ?? 0)} → ${fmt(updatedSale.amountPaid ?? 0)}`);
            if (diff.productName) changes.push(`produto ${before.productName} → ${updatedSale.productName}`);
            if (changes.length) {
                inventoryContext.notifyManagers({
                    type: 'security',
                    title: `✏️ Venda ${before.guideNumber || ''} alterada`,
                    body: `${user.username || '—'} · ${changes.join(' · ')}`,
                    link: before.guideNumber ? links.sale(before.guideNumber) : '/sales',
                });
            }
        }

        try {
            const saleRef = doc(firestore, `companies/${companyId}/sales`, updatedSale.id);
            const batch = writeBatch(firestore);
            batch.update(saleRef, changesToUpdate(diff));
            batch.set(doc(collection(saleRef, 'history')), {
                action: 'editada',
                userId: user.id,
                userName: user.username,
                at: serverTimestamp(),
                guideNumber: before.guideNumber || null,
                changes: diff,
            });
            await batch.commit();
            // Proforma que passa a paga tem de reservar o stock (antes ficava "Pago" sem reserva).
            if (before.status === 'Pendente' && updatedSale.status === 'Pago') {
                try { await (inventoryContext as any)?.recalculateReservedStock?.(); } catch { /* o botão de recalcular continua disponível */ }
            }
            toast({
                title: "Venda Atualizada",
                description: `A venda #${updatedSale.guideNumber} foi atualizada com sucesso.`,
            });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível atualizar a venda", description: e?.message || "Tente de novo." });
        }
    };

    const confirmPickup = async (sale: Sale) => {
        try {
            if (!inventoryContext?.confirmSalePickup) throw new Error("Função de levantamento não disponível.");
            await inventoryContext.confirmSalePickup(sale);
            toast({
                title: "Material Levantado",
                description: `O stock foi atualizado para a venda #${sale.guideNumber}.`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro no Levantamento",
                description: error.message || "Não foi possível confirmar o levantamento.",
            });
        }
    };

    const removeSale = async (saleId: string) => {
        try {
            await inventoryContext?.deleteSale(saleId);
        } catch {
            // o erro já é mostrado pelo contexto
        }
    };

    return {
        updateSale,
        confirmPickup,
        removeSale,
        canEditSales: !!inventoryContext?.canEdit?.('sales'),
    };
}
