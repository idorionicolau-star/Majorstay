// Cópias de segurança diárias (ver app/api/cron/backup): nomes dos ficheiros e quais apagar. Puro, testado.

export const BACKUP_PREFIX = 'backups/';
export const BACKUP_KEEP_DAYS = 14;

/** "backups/2026-10-12/<empresa>.json" */
export const backupPath = (day: string, name: string) => `${BACKUP_PREFIX}${day}/${name}.json`;

export const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Os ficheiros de cópias com mais de `keepDays` dias (pelo dia no caminho). */
export function expiredBackups(pathnames: string[], now: Date, keepDays = BACKUP_KEEP_DAYS): string[] {
    const limit = dayOf(new Date(now.getTime() - keepDays * 86_400_000));
    return pathnames.filter((p) => {
        const m = p.match(/^backups\/(\d{4}-\d{2}-\d{2})\//);
        return !!m && m[1] < limit;
    });
}
