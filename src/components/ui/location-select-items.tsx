"use client";

import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { siteOf, sitesOf, sortBySite } from "@/lib/sites";
import type { Location } from "@/lib/types";

/**
 * Opções de localização para um <Select>: com pontos, ficam agrupadas por ponto (título do ponto e, em cada opção,
 * "Ponto · Local", para o escolhido se ler bem no botão). Sem pontos, só os nomes, como sempre.
 */
export function LocationSelectItems({ locations }: { locations: Location[] }) {
    if (!sitesOf(locations).length) return <>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</>;
    const groups: { site: string; items: Location[] }[] = [];
    for (const l of sortBySite(locations)) {
        const site = siteOf(l) || "Sem ponto";
        if (groups[groups.length - 1]?.site !== site) groups.push({ site, items: [] });
        groups[groups.length - 1].items.push(l);
    }
    return (
        <>
            {groups.map((g) => (
                <SelectGroup key={g.site}>
                    <SelectLabel className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.site}</SelectLabel>
                    {g.items.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                            {siteOf(l) ? <><span className="text-muted-foreground">{siteOf(l)} · </span>{l.name}</> : l.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            ))}
        </>
    );
}
