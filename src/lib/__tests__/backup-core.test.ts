import { describe, it, expect } from 'vitest';
import { backupPath, expiredBackups } from '@/lib/backup-core';

describe('cópias de segurança', () => {
    it('um ficheiro por dia e por empresa', () => {
        expect(backupPath('2026-10-12', 'c1')).toBe('backups/2026-10-12/c1.json');
    });
    it('apaga só as com mais de 14 dias', () => {
        const now = new Date('2026-10-20T03:00:00Z');
        const files = ['backups/2026-10-05/a.json', 'backups/2026-10-06/a.json', 'backups/2026-10-19/a.json', 'outra/coisa.json'];
        expect(expiredBackups(files, now)).toEqual(['backups/2026-10-05/a.json']);
    });
});
