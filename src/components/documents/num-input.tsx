"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo numérico que deixa escrever à vontade ("", "1.", "0,5"): guarda o texto enquanto se escreve e só envia o
 * número quando é válido. Com <input type=number> controlado, apagar o "0" ou escrever "1." fazia o valor saltar.
 */
export function NumInput({ value, onValue, min = 0, max, disabled, placeholder, className, decimals = true, "aria-label": aria }: {
    value: number | undefined; onValue: (n: number | undefined) => void; min?: number; max?: number; disabled?: boolean; placeholder?: string; className?: string; decimals?: boolean; "aria-label"?: string;
}) {
    const show = (v: number | undefined) => (v === undefined || v === null || Number.isNaN(v) ? "" : String(v));
    const [text, setText] = useState(show(value));
    const [focus, setFocus] = useState(false);
    useEffect(() => { if (!focus) setText(show(value)); }, [value, focus]);

    return (
        <Input
            inputMode={decimals ? "decimal" : "numeric"}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
            aria-label={aria}
            onFocus={(e) => { setFocus(true); e.target.select(); }}
            onBlur={() => { setFocus(false); setText(show(value)); }}
            onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                setText(e.target.value);
                if (raw === "" || raw === ".") { onValue(undefined); return; }
                let n = parseFloat(raw);
                if (Number.isNaN(n)) return;
                n = Math.max(min, max !== undefined ? Math.min(max, n) : n);
                onValue(n);
            }}
        />
    );
}
