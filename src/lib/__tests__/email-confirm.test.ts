import { describe, expect, it } from 'vitest';
import { canMarkVerified, needsEmailConfirm } from '../email-confirm';

describe('confirmar o email antes do primeiro produto', () => {
    const nova = { status: 'trial' };
    it('conta nova sem produtos: pede a confirmação', () => {
        expect(needsEmailConfirm(nova, 0)).toBe(true);
    });
    it('já confirmado, já com produtos, ou conta paga/antiga: não pede', () => {
        expect(needsEmailConfirm({ ...nova, emailVerifiedAt: '2026-10-18T10:00:00Z' }, 0)).toBe(false);
        expect(needsEmailConfirm(nova, 3)).toBe(false);
        expect(needsEmailConfirm({ status: 'active' }, 0)).toBe(false);
        expect(needsEmailConfirm({}, 0)).toBe(false);
        expect(needsEmailConfirm(null, 0)).toBe(false);
    });
    it('só um Dono/Admin com email confirmado regista a confirmação', () => {
        expect(canMarkVerified('Admin', true)).toBe(true);
        expect(canMarkVerified('Dono', true)).toBe(true);
        expect(canMarkVerified('Employee', true)).toBe(false);
        expect(canMarkVerified('Admin', false)).toBe(false);
    });
});
