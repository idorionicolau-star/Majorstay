"use client";

// O que o utilizador já viu (tutoriais feitos, convites fechados, boas-vindas, tour) fica guardado no aparelho
// (localStorage) E na conta (users/{uid}.seen), para não voltar a perguntar noutro telemóvel, noutro navegador,
// na app instalada (que no iPhone tem armazenamento próprio) ou depois de limpar os dados.
import { useContext, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore } from "@/firebase";
import { PREFIX, isSynced, localSeen, setSeenReady, setSeenRemote } from "@/lib/seen-store";

/** Montado uma vez no layout: junta o que está no aparelho com o que está na conta. */
export function SeenSync() {
    const ctx = useContext(InventoryContext);
    const firestore = useFirestore();
    const uid = ctx?.firebaseUser?.uid;
    const isGuest = !!ctx?.isGuest;

    useEffect(() => {
        // convidado: não tem conta no servidor — fica só o que está no aparelho (sem ler nem gravar users/guest-demo-uid)
        if (!firestore || !uid || isGuest) return;
        let alive = true;
        const ref = doc(firestore, `users/${uid}`);
        const write = (names: string[]) => {
            if (!names.length) return;
            const seen: Record<string, true> = {};
            for (const n of names) seen[n] = true;
            setDoc(ref, { seen }, { merge: true }).catch(() => { /* sem permissão/rede: fica só no aparelho */ });
        };
        setSeenRemote((name) => write([name]));
        (async () => {
            let fromAccount: string[] = [];
            try {
                const snap = await getDoc(ref);
                const seen = (snap.data()?.seen || {}) as Record<string, unknown>;
                fromAccount = Object.keys(seen).filter((k) => seen[k] && isSynced(k));
            } catch { /* sem rede: fica com o que está no aparelho */ }
            if (!alive) return;
            const local = new Set(localSeen());
            let changed = false;
            for (const n of fromAccount) {
                if (local.has(n)) continue;
                try { localStorage.setItem(PREFIX + n, "1"); changed = true; } catch { /* ignore */ }
            }
            const have = new Set(fromAccount);
            write([...local].filter((n) => !have.has(n)));
            setSeenReady(true);
            window.dispatchEvent(new Event("msx:seen-sync"));
            if (changed) {
                window.dispatchEvent(new Event("msx:guide-done"));
                window.dispatchEvent(new Event("msx:tour-seen"));
            }
        })();
        return () => {
            alive = false;
            setSeenRemote(null);
        };
    }, [firestore, uid, isGuest]);

    return null;
}
