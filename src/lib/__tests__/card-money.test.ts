import { describe, expect, it } from "vitest";
import { cardMoneySize, formatCardMoney } from "../utils";

describe("valores nos cartões", () => {
    it("a partir de um milhão usa o formato curto", () => {
        expect(formatCardMoney(110_030_583)).toBe("110M MTn");
        expect(formatCardMoney(1_265_216_537)).toMatch(/^1\s?265,2M MTn$/);
        expect(formatCardMoney(-2_500_000)).toMatch(/M MTn$/);
    });

    it("abaixo de um milhão mostra o valor exacto", () => {
        expect(formatCardMoney(999_999)).toMatch(/999\s999,00/);
        expect(formatCardMoney(0)).toMatch(/^0,00/);
    });

    it("letra mais pequena para os valores compridos", () => {
        expect(cardMoneySize("110M MTn")).toContain("text-xl");
        expect(cardMoneySize("99 999,00 MTn")).toContain("text-lg");
        expect(cardMoneySize("-999 999,00 MTn")).toContain("text-base");
    });
});
