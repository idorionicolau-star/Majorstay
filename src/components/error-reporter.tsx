"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/** Apanha erros que escapam ao React (eventos, promessas) e envia-os para o registo. */
export function ErrorReporter() {
    useEffect(() => {
        const onError = (ev: ErrorEvent) => reportError(ev.error || ev.message, "window");
        const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason, "promise");
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    }, []);
    return null;
}
