import { afterEach, describe, expect, it, vi } from "vitest";
import { INTRO_ALWAYS_KEY, INTRO_AT_KEY, INTRO_GATE, INTRO_KEY } from "../intro-gate";

/** corre o script do <head> com um navegador de mentira; devolve se a entrada aparece */
function shows(opts: { lastSeen?: Date; search?: string; path?: string; webdriver?: boolean; noLocal?: boolean; sessionSeen?: boolean; always?: boolean }) {
    const html = { dataset: {} as Record<string, string> };
    const local = { getItem: (k: string) => { if (opts.noLocal) throw new Error("bloqueado"); if (k === INTRO_ALWAYS_KEY) return opts.always ? "1" : null; return k === INTRO_AT_KEY && opts.lastSeen ? String(opts.lastSeen.getTime()) : null; } };
    const session = { getItem: (k: string) => (k === INTRO_KEY && opts.sessionSeen ? "1" : null) };
    new Function("document", "location", "localStorage", "sessionStorage", "navigator", INTRO_GATE)(
        { documentElement: html }, { search: opts.search || "", pathname: opts.path || "/dashboard" }, local, session, { webdriver: !!opts.webdriver });
    return html.dataset.intro !== "skip";
}

describe("animação de entrada: uma vez por dia", () => {
    afterEach(() => { vi.useRealTimers(); });
    const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };

    it("aparece na primeira abertura", () => {
        expect(shows({})).toBe(true);
    });

    it("não volta no mesmo dia, nem horas depois", () => {
        at("2026-10-28T18:00:00");
        expect(shows({ lastSeen: new Date("2026-10-28T07:05:00") })).toBe(false);
        expect(shows({ lastSeen: new Date("2026-10-28T17:59:00") })).toBe(false);
    });

    it("volta no dia seguinte, mesmo que tenham passado poucas horas", () => {
        at("2026-10-29T06:30:00");
        expect(shows({ lastSeen: new Date("2026-10-28T23:50:00") })).toBe(true);
    });

    it("?intro=1 mostra sempre; testes automáticos e páginas legais nunca", () => {
        at("2026-10-28T12:00:00");
        expect(shows({ lastSeen: new Date("2026-10-28T11:00:00"), search: "?intro=1" })).toBe(true);
        expect(shows({ webdriver: true })).toBe(false);
        expect(shows({ path: "/termos" })).toBe(false);
    });

    it("sem localStorage vale a sessão", () => {
        expect(shows({ noLocal: true })).toBe(true);
        expect(shows({ noLocal: true, sessionSeen: true })).toBe(false);
    });

    it("super-administrador: sempre que a app abre (nova sessão), mas recarregar não repete", () => {
        at("2026-10-28T18:00:00");
        const seenToday = new Date("2026-10-28T09:00:00");
        expect(shows({ always: true, lastSeen: seenToday })).toBe(true); // fechou e abriu a app
        expect(shows({ always: true, lastSeen: seenToday, sessionSeen: true })).toBe(false); // recarregou
        expect(shows({ always: false, lastSeen: seenToday })).toBe(false); // os outros: uma vez por dia
    });
});
