"use client";

import { useSyncExternalStore } from "react";
import { getNavHint, subscribeNavHint, type NavHint } from "@/lib/nav-hint";

/** O menu guardado da última vez (null no servidor e sem sessão guardada). Ver lib/nav-hint.ts. */
export function useNavHint(): NavHint | null {
    return useSyncExternalStore(subscribeNavHint, getNavHint, () => null);
}
