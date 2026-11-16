import { describe, it, expect } from 'vitest';
import { rateLimitOk } from './rate-limit';

const req = (ip?: string) => new Request('http://x/y', { headers: ip ? { 'x-forwarded-for': ip } : {} });

describe('limite por IP', () => {
  it('bloqueia depois do máximo e não mistura IPs', () => {
    for (let i = 0; i < 3; i++) expect(rateLimitOk(req('1.1.1.1'), 't1', 3, 60_000)).toBe(true);
    expect(rateLimitOk(req('1.1.1.1'), 't1', 3, 60_000)).toBe(false);
    expect(rateLimitOk(req('2.2.2.2'), 't1', 3, 60_000)).toBe(true);
  });
  it('sem IP não limita', () => {
    for (let i = 0; i < 50; i++) expect(rateLimitOk(req(), 't2', 1, 60_000)).toBe(true);
  });
});
