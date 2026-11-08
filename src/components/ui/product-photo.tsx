"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product image that falls back to a "Sem foto" tile when the URL is missing or fails to load. */
export function ProductPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return (
            <div className={cn("flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700/80", className)}>
                <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sem Foto</span>
            </div>
        );
    }
    return (
        <div className={cn("overflow-hidden bg-slate-100 dark:bg-slate-800", className)}>
            <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        </div>
    );
}
