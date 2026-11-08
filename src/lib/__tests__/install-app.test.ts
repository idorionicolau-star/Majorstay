import { describe, it, expect } from 'vitest';
import { installMode, isIos, isIosSafari, DISMISS_DAYS } from '@/lib/install-app';

const base = { standalone: false, ios: false, safari: false, canPrompt: false, dismissedAt: 0, now: 1_000_000_000_000 };

describe('installMode', () => {
    it('não mostra se já está instalada', () => expect(installMode({ ...base, standalone: true, canPrompt: true })).toBe('none'));
    it('Android/computador: botão de instalar', () => expect(installMode({ ...base, canPrompt: true })).toBe('prompt'));
    it('iPhone no Safari: guia', () => expect(installMode({ ...base, ios: true, safari: true })).toBe('ios'));
    it('iPhone noutro navegador: nada', () => expect(installMode({ ...base, ios: true, safari: false })).toBe('none'));
    it('dispensado há pouco: não insiste', () => {
        expect(installMode({ ...base, canPrompt: true, dismissedAt: base.now - 86_400_000 })).toBe('none');
    });
    it('dispensado há muito: volta', () => {
        expect(installMode({ ...base, canPrompt: true, dismissedAt: base.now - (DISMISS_DAYS + 1) * 86_400_000 })).toBe('prompt');
    });
});

describe('detecção do navegador', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const chromeIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
    it('reconhece iPhone', () => { expect(isIos(safari)).toBe(true); expect(isIos('Mozilla/5.0 (Linux; Android 14)')).toBe(false); });
    it('Safari sim, Chrome do iPhone não', () => { expect(isIosSafari(safari)).toBe(true); expect(isIosSafari(chromeIos)).toBe(false); });
});
