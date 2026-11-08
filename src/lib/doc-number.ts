import type { DocumentType } from '@/lib/doc-model';

export type NumberingConfig = { prefix?: string; separator?: string; nextNumber?: number; padding?: number };
type CompanyNumbering = { documentNumbering?: Record<string, NumberingConfig>; saleCounter?: number };

export const defaultPrefix = (type: DocumentType | string): string => {
    switch (type) {
        case 'Cotação': return 'COT';
        case 'Factura Proforma': return 'FP';
        case 'Recibo': return 'REC';
        case 'Guia de Remessa': return 'GR';
        case 'Factura': return 'FAT';
        default: return 'VD';
    }
};

/**
 * O número que a numeração da empresa daria agora a este tipo de documento.
 * `fromConfig`: veio da numeração configurada (prefixo + próximo número); senão usa o contador geral.
 */
export function suggestNumber(type: DocumentType | string, company: CompanyNumbering | null | undefined): { number: string; fromConfig: boolean } {
    const cfg = company?.documentNumbering?.[type];
    if (cfg && cfg.prefix) {
        const n = cfg.nextNumber || 1;
        const padded = (cfg.padding || 0) > 0 ? String(n).padStart(cfg.padding as number, '0') : String(n);
        return { number: `${cfg.prefix}${cfg.separator || ''}${padded}`, fromConfig: true };
    }
    return { number: `${defaultPrefix(type)}-${String((company?.saleCounter || 0) + 1).padStart(6, '0')}`, fromConfig: false };
}
