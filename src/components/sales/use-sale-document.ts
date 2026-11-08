"use client";

// O documento de uma venda (imprimir, PDF, recibo por email): o mesmo na tabela do Histórico e na ficha da venda.
import { useContext } from "react";
import type { Sale } from "@/lib/types";
import { InventoryContext } from "@/context/inventory-context";
import { useCRM } from "@/context/crm-context";
import { useToast } from "@/hooks/use-toast";
import { downloadSaleDocument } from "@/lib/utils";

export function useSaleDocument(sale: Sale) {
    const inventoryContext = useContext(InventoryContext);
    const companyData = inventoryContext?.companyData;
    const { customers } = useCRM();
    const { toast } = useToast();
    const customer = customers.find(c => c.id === sale.customerId);

    // O documento leva todos os artigos com o mesmo número (uma venda com vários produtos).
    const documentLines = () => {
        const same = sale.guideNumber
            ? (inventoryContext?.sales || []).filter(s => s.guideNumber === sale.guideNumber && s.documentType === sale.documentType)
            : [];
        return same.length ? same : [sale];
    };

    const sendReceipt = async () => {
        if (!customer || !customer.email) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cliente sem email registado.' });
            return;
        }

        toast({ title: 'A enviar recibo...', description: `Para: ${customer.email}` });

        try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();

            if (!token) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Sessão expirada. Faça login novamente.' });
                return;
            }

            const response = await fetch('/api/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'RECEIPT',
                    to: customer.email,
                    subject: `Recibo de Venda - ${sale.guideNumber}`,
                    companyId: companyData?.id,
                    logoUrl: companyData?.logoUrl,
                    customerName: customer.name,
                    guideNumber: sale.guideNumber,
                    // todos os produtos com o mesmo número (antes o recibo levava só este)
                    items: documentLines().map((s) => ({ productName: s.productName, quantity: s.quantity, subtotal: s.totalValue })),
                    totalValue: documentLines().reduce((t, s) => t + (Number(s.totalValue) || 0), 0),
                    date: sale.date,
                    companyName: companyData?.name || 'Major Group'
                })
            });

            if (response.ok) {
                toast({ title: 'Recibo Enviado', description: 'O cliente receberá o email em breve.' });
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro ${response.status}`);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: `Não foi possível enviar o recibo: ${error.message || error}` });
        }
    };

    const download = async () => {
        try {
            const { downloadSaleDocumentPDF } = await import("@/lib/sale-document-pdf");
            await downloadSaleDocumentPDF(documentLines(), companyData || null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Não foi possível gerar o PDF', description: e?.message || 'Tente de novo.' });
        }
    };

    const print = () => {
        downloadSaleDocument(documentLines(), companyData || null);
    };

    return { customer, documentLines, sendReceipt, download, print };
}
