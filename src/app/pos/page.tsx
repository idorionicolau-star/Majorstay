"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FastSale } from "@/components/pos/fast-sale";
import { useInventory } from "@/context/inventory-context";
import { getSellMode, setSellMode } from "@/lib/sell-mode";

export default function FastSalePage() {
    const { canEdit, loading } = useInventory();
    const router = useRouter();
    // abre no modo que a pessoa usou da última vez (Vender por toque ou escrever/ler código)
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("modo") === "rapida") setSellMode("rapida");
        else if (getSellMode() === "toque") { router.replace("/pos/catalogo"); return; }
        setReady(true);
    }, [router]);
    if (!ready) return null;
    if (!loading && !canEdit("sales")) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">Não tem permissão para registar vendas.</p>
            </div>
        );
    }
    return <FastSale />;
}
