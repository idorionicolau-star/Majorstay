"use client";

import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useInventory } from "@/context/inventory-context";
import { normalizeBarcode } from "@/lib/barcode";
import type { Product } from "@/lib/types";

/**
 * Guarda o código de barras no produto (em todos os documentos que o compõem, um por local).
 * Funciona sem internet (fica na fila e sincroniza). Devolve false se não houver permissão.
 */
export function useBarcodeLink() {
    const firestore = useFirestore();
    const { companyId, canEdit } = useInventory();
    const allowed = canEdit("inventory");

    const link = useCallback(
        (product: Product, rawCode: string): boolean => {
            const code = normalizeBarcode(rawCode);
            if (!firestore || !companyId || !allowed || !code) return false;
            const ids = product.sourceIds?.length ? product.sourceIds : product.id ? [product.id] : [];
            if (!ids.length) return false;
            ids.forEach((id) => {
                // não esperamos: offline a promessa só termina quando a internet volta
                updateDoc(doc(firestore, `companies/${companyId}/products`, id), { barcode: code }).catch((e) => console.warn("[barcode] não guardou", e));
            });
            return true;
        },
        [firestore, companyId, allowed],
    );
    return { link, canLink: allowed };
}
