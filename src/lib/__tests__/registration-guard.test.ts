import { describe, expect, it } from 'vitest';
import { beginRegistration, endRegistration, registrationPending } from '../registration-guard';

describe('registration-guard', () => {
    it('quem abre a sessão espera pelo fim do registo', async () => {
        expect(registrationPending()).toBeNull();
        beginRegistration();
        const p = registrationPending();
        expect(p).not.toBeNull();
        let waited = false;
        const waiter = p!.then(() => { waited = true; });
        await Promise.resolve();
        expect(waited).toBe(false); // ainda a registar
        endRegistration();
        await waiter;
        expect(waited).toBe(true);
        expect(registrationPending()).toBeNull();
    });
});
