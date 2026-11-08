import { describe, expect, it } from "vitest";
import { parseNavHint } from "../nav-hint";

describe("parseNavHint", () => {
    it("lê o menu guardado", () => {
        const raw = JSON.stringify({ items: [{ title: "Dashboard", id: "dashboard", href: "/dashboard" }, { title: "Relatórios", id: "reports", href: "/finance", locked: true }], simple: true, name: "Ana" });
        expect(parseNavHint(raw)).toEqual({
            items: [{ title: "Dashboard", id: "dashboard", href: "/dashboard" }, { title: "Relatórios", id: "reports", href: "/finance", locked: true }],
            simple: true, name: "Ana", email: undefined,
        });
    });

    it("ignora o que não é um menu válido", () => {
        expect(parseNavHint(null)).toBeNull();
        expect(parseNavHint("{")).toBeNull();
        expect(parseNavHint("{}")).toBeNull();
        expect(parseNavHint(JSON.stringify({ items: [{ title: "X", id: "x", href: "https://mau.example" }, { id: "y" }] }))?.items).toEqual([]);
    });
});
