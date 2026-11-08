import { describe, expect, it } from "vitest";
import { BOOT_DONE, bootLabel, bootRange, bootStepOf, getBootStep, setBootStep } from "../boot-progress";

describe("boot-progress", () => {
    it("fase a partir do estado da app", () => {
        const base = { authLoading: false, signedIn: false, productsLoading: false, salesLoading: false };
        expect(bootStepOf({ ...base, authLoading: true })).toBe(0);
        expect(bootStepOf({ ...base, authLoading: true, signedIn: true })).toBe(1);
        expect(bootStepOf({ ...base, signedIn: true, productsLoading: true, salesLoading: true })).toBe(2);
        expect(bootStepOf({ ...base, signedIn: true, salesLoading: true })).toBe(3);
        expect(bootStepOf(base)).toBe(BOOT_DONE);
    });

    it("a barra nunca passa a fase seguinte antes de ela acabar", () => {
        for (let s = 0; s < BOOT_DONE; s++) {
            const [lo, hi] = bootRange(s);
            expect(hi).toBeLessThan(bootRange(s + 1)[0]);
            expect(lo).toBeLessThan(hi);
        }
        expect(bootRange(BOOT_DONE)).toEqual([1, 1]);
        expect(bootRange(-1)[0]).toBe(0);
    });

    it("só avança durante um arranque e recomeça depois de pronto", () => {
        setBootStep(2);
        setBootStep(1);
        expect(getBootStep()).toBe(2);
        setBootStep(BOOT_DONE);
        setBootStep(0);
        expect(getBootStep()).toBe(0);
    });

    it("textos", () => {
        expect(bootLabel(-1)).toBe("A carregar…");
        expect(bootLabel(-1, "A recarregar…")).toBe("A recarregar…");
        expect(bootLabel(2)).toBe("A carregar produtos…");
        expect(bootLabel(BOOT_DONE)).toBe("Pronto");
    });

    it("textos ao recarregar dentro da app", () => {
        const reload = { reload: true };
        expect(bootLabel(0, "A recarregar…", reload)).toBe("A ligar…");
        expect(bootLabel(1, "A recarregar…", reload)).toBe("A ligar…");
        expect(bootLabel(2, "A recarregar…", reload)).toBe("A atualizar produtos…");
        expect(bootLabel(3, "A recarregar…", reload)).toBe("A atualizar vendas…");
        expect(bootLabel(BOOT_DONE, "A recarregar…", reload)).toBe("Atualizado");
        expect(bootLabel(BOOT_DONE, "A recarregar…", { reload: true, offline: true })).toBe("Sem internet: últimos dados guardados");
    });
});
