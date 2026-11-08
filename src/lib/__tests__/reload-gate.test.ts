import { describe, expect, it } from "vitest";
import { NAV_HINT_KEY, RELOAD_GATE, initialsOf } from "../nav-hint";

/** corre o script do <head> com um localStorage e um <html> de mentira */
function runGate(hint: unknown) {
    const props: Record<string, string> = {};
    const html = { dataset: {} as Record<string, string>, style: { setProperty: (k: string, v: string) => { props[k] = v; } } };
    const storage = { getItem: (k: string) => (k === NAV_HINT_KEY && hint !== undefined ? JSON.stringify(hint) : null) };
    new Function("localStorage", "document", RELOAD_GATE)(storage, { documentElement: html });
    return { reload: html.dataset.reload, props };
}

describe("RELOAD_GATE", () => {
    it("sem sessão guardada não marca nada", () => {
        expect(runGate(undefined)).toEqual({ reload: undefined, props: {} });
    });

    it("marca a recarga e põe as iniciais iguais às do avatar", () => {
        for (const name of ["Idório Nicolau", "Admin", "  Ana  Maria Sousa ", "x"]) {
            const r = runGate({ items: [], simple: false, name });
            expect(r.reload).toBe("1");
            expect(r.props["--msx-initials"]).toBe(JSON.stringify(initialsOf(name)));
        }
        expect(initialsOf("Idório Nicolau")).toBe("IN");
        expect(initialsOf("Admin")).toBe("AD");
    });

    it("com foto usa a foto (só https)", () => {
        expect(runGate({ items: [], simple: false, name: "Ana", photo: "https://x.example/a.jpg" }).props).toEqual({ "--msx-avatar-photo": 'url("https://x.example/a.jpg")' });
        expect(runGate({ items: [], simple: false, name: "Ana", photo: "javascript:alert(1)" }).props).toEqual({ "--msx-initials": '"AN"' });
    });

    it("dados estragados não partem a página", () => {
        const html = { dataset: {}, style: { setProperty: () => {} } };
        expect(() => new Function("localStorage", "document", RELOAD_GATE)({ getItem: () => "{" }, { documentElement: html })).not.toThrow();
    });
});
