import { describe, expect, it } from "vitest";
import { PULL_MAX, PULL_TRIGGER, isPullDown, pullDistance, refreshMessage } from "../pull-refresh";

describe("puxar para atualizar", () => {
    it("o indicador segue o dedo com resistência e tem um máximo", () => {
        expect(pullDistance(-20)).toBe(0);
        expect(pullDistance(40)).toBe(20);
        expect(pullDistance(PULL_TRIGGER * 2)).toBe(PULL_TRIGGER);
        expect(pullDistance(2000)).toBe(PULL_MAX);
        // sempre a crescer
        let last = 0;
        for (let dy = 0; dy < 600; dy += 10) { const d = pullDistance(dy); expect(d).toBeGreaterThanOrEqual(last); last = d; }
    });

    it("só conta como puxar para baixo se for claramente vertical", () => {
        expect(isPullDown(0, 30)).toBe(true);
        expect(isPullDown(30, 30)).toBe(false); // diagonal: pode ser o deslizar entre páginas
        expect(isPullDown(0, -30)).toBe(false); // scroll
        expect(isPullDown(0, 5)).toBe(false); // ainda não decidiu
    });

    it("mensagens", () => {
        expect(refreshMessage("updated")).toBe("Atualizado");
        expect(refreshMessage("offline")).toMatch(/Sem internet/);
        expect(refreshMessage("unreachable")).toMatch(/Sem ligação/);
    });
});

describe("objecto do indicador por página", async () => {
    const { pullObjectFor } = await import("../pull-refresh");
    it("cada página com o seu objecto", () => {
        expect(pullObjectFor("/pos")).toBe("cart");
        expect(pullObjectFor("/pos/catalogo")).toBe("cart");
        expect(pullObjectFor("/sales")).toBe("cart");
        expect(pullObjectFor("/sales/carga")).toBe("truck");
        expect(pullObjectFor("/orders")).toBe("truck");
        expect(pullObjectFor("/inventory/transfer")).toBe("truck");
        expect(pullObjectFor("/inventory")).toBe("warehouse");
        expect(pullObjectFor("/inventory/quick")).toBe("warehouse");
        expect(pullObjectFor("/catalog")).toBe("warehouse");
        expect(pullObjectFor("/production/new")).toBe("mixer");
        expect(pullObjectFor("/dashboard")).toBe("laptop");
        expect(pullObjectFor("/finance")).toBe("laptop");
        expect(pullObjectFor("/salesman")).toBe("cart"); // não confunde /sales com /salesman (cai no carrinho por defeito)
        expect(pullObjectFor("/qualquer")).toBe("cart");
    });
});
