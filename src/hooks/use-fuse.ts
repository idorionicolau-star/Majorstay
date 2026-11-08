import { useMemo, useState } from 'react';
import Fuse, { IFuseOptions } from 'fuse.js';

export function useFuse<T>(
    list: T[],
    searchTerm: string,
    options: IFuseOptions<T>
) {
    const results = useMemo(() => {
        if (!searchTerm) return list;

        // Multi-term AND logic:
        // We split the search term by spaces and require ALL terms to match.
        // Fuse.js supports this via logical query operators:
        // { $and: [ { $or: [{ key1: "term1" }, { key2: "term1" }] }, ... ] }

        // However, constructing this dynamic query for generic keys is complex.
        // A simpler robust approach with Fuse is to use the extended search syntax 
        // OR simply filter iteratively if the list isn't huge (which it likely isn't for client-side).

        // Let's use an iterative approach for stability and predictability:
        // 1. Split terms.
        // 2. Filter the list for Term 1 -> Result 1
        // 3. Filter Result 1 for Term 2 -> Result 2
        // ...

        const terms = searchTerm
            .split(/\s+/)
            .filter(term => term.trim().length > 0);

        let currentList = list;

        terms.forEach(term => {
            const fuseInstance = new Fuse(currentList, {
                threshold: 0.15,
                ignoreLocation: true,
                ...options
            });
            const result = fuseInstance.search(term);
            currentList = result.map(r => r.item);
        });

        return currentList;
    }, [list, searchTerm, options]);

    return results;
}


