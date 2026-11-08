"use client";

import { useEffect, useState } from "react";
import { inventoryReturnUrl } from "@/lib/deep-links";

/** O "Voltar ao inventário" das sub-páginas: regressa ao inventário como estava (com o filtro do aviso). */
export function useInventoryBackHref() {
    const [href, setHref] = useState("/inventory");
    useEffect(() => { setHref(inventoryReturnUrl()); }, []);
    return href;
}
