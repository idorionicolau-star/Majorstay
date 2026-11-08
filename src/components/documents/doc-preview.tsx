"use client";

import { useEffect, useRef, useState } from "react";
import type { Company } from "@/lib/types";
import { docTitle, docTotals, isQuoteLike, itemSubtotal, type DocModel } from "@/lib/doc-model";
import { hexToRgb, isDecor, readableOn, rgbToHex, SWIRL_FOOT, SWIRL_LIGHT, SWIRL_NAVY, themeById, tint, type DecorPath, type DocDecor, type RGB } from "@/lib/doc-themes";
import { formatCurrency } from "@/lib/utils";

const PAGE_W = 794; // A4 a 96 dpi
const PAGE_H = 1123;
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** milímetros do PDF → pixels da página (A4 = 210 mm = 794 px) */
const mm = (v: number) => (v * PAGE_W) / 210;
/** tamanho de letra do PDF (pontos) → pixels */
const pt = (v: number) => v * 1.333;
const CHARCOAL: RGB = [38, 38, 48];
const INK: RGB = [43, 46, 56]; // o escuro do "executivo"
const date = (iso?: string) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString("pt-PT") : ""; };

/**
 * Pré-visualização do documento em HTML, à escala do ecrã. Funciona em todos os aparelhos (um PDF dentro de uma
 * moldura não aparece nos telemóveis) e actualiza-se a cada tecla. O PDF final segue o mesmo tema e cores.
 */
export function DocPreview({ model, company }: { model: DocModel; company: Company | null }) {
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const fit = () => setScale(Math.max(0.2, Math.min(1.2, el.clientWidth / PAGE_W)));
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const st = model.style || {};
    const theme = themeById(st.theme);
    const accent = hexToRgb(st.accent) || theme.defaultAccent;
    const on = readableOn(accent);
    const soft = tint(accent, 0.92);
    const serif = theme.font === "times";
    const t = docTotals({ items: model.items, discount: model.discount, vat: model.vat, paid: model.paid });
    const quote = isQuoteLike(model.type);
    const items = model.items.filter((i) => i.description.trim() || Number(i.unitPrice));
    const D = theme.header;
    const decor = isDecor(D) ? D : null;
    const headBand = !decor && (theme.header === "band" || theme.header === "block");
    const hl = theme.highlight || ([250, 204, 21] as RGB);
    const company_ = [company?.taxId ? `NUIT: ${company.taxId}` : "", company?.address, company?.phone, company?.email].filter(Boolean);

    const logo = st.showLogo !== false && company?.logoUrl ? <img src={company.logoUrl} alt="" style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain" }} /> : null;
    // no "cartão" o cabeçalho da tabela enche o cartão branco que está sobre a faixa de cor
    const numbered = !!theme.numbered;
    const center = decor === "glass"; // o Vidro centra todas as colunas
    const th = { padding: decor === "card" ? "14px 10px" : decor === "glass" ? "26px 10px" : decor === "poster" ? "17px 10px" : "8px 10px", textAlign: (center ? "center" : "left") as "center" | "left", fontSize: decor === "swirl" ? 13 : 11, fontWeight: 700, letterSpacing: 0.3 };
    const thR = { ...th, textAlign: (center ? "center" : "right") as "center" | "right" };
    const td = { padding: decor === "glass" || decor === "poster" ? "13px 10px" : "8px 10px", textAlign: (center ? "center" : "right") as "center" | "right", whiteSpace: "nowrap" as const, fontSize: decor === "ribbon" ? 11.5 : undefined };
    const headStyle = decor === "card" ? { background: "#fff", color: css(accent) }
        : decor === "frame" || decor === "poster" ? { background: css(hl), color: css(readableOn(hl)) }
            : decor === "stripes" ? { background: css(CHARCOAL), color: "#fff" }
                : decor === "ribbon" ? { background: css(INK), color: "#fff" }
                    : decor === "glass" ? { background: "rgb(243,244,248)", color: "rgb(70,72,88)", boxShadow: "3px 5px 0 rgb(214,218,228)" }
                        : decor === "atelier" ? { color: css(accent), borderTop: `1.5px solid ${css(accent)}`, borderBottom: `1.5px solid ${css(accent)}` }
                            : decor === "hatch" ? { background: `repeating-linear-gradient(-45deg, #fff 0 5px, ${css([222, 222, 230])} 5px 6px)`, color: css(accent), borderTop: `1.5px solid ${css(accent)}`, borderBottom: `1.5px solid ${css(accent)}` }
                                : theme.table === "filled" ? { background: css(accent), color: css(on) } : theme.table === "striped" ? { background: css(soft), color: css(accent) } : { borderBottom: `2px solid ${css(accent)}`, color: css(accent) };
    // onde começa o conteúdo e as margens, iguais às do PDF
    const top = decor ? ({ wave: 80, card: 64.5, frame: 86, stripes: 50, hatch: 55, corner: 56, circles: 56, glass: 74, poster: 80, atelier: 84, ribbon: 63, swirl: 94 } as Record<DocDecor, number>)[decor] : 0;
    const side = decor === "frame" ? mm(20) : decor === "glass" ? mm(22) : decor === "poster" ? mm(21) : 48;
    const showBoxes = !["card", "frame", "glass", "poster", "atelier", "ribbon", "swirl"].includes(decor || "");
    // linhas da tabela: riscadas alternadas no Atelier, sem linhas no Vidro e no Cartaz, vermelhas no Executivo
    const rowStyle = (n: number): React.CSSProperties => decor === "atelier" ? { background: n % 2 ? undefined : "#fff", borderBottom: "none" }
        : decor === "glass" || decor === "poster" ? { borderBottom: "none" }
            : decor === "ribbon" ? { borderBottom: `1px solid ${css(accent)}` }
                : { background: theme.table === "striped" && n % 2 ? "#fafafa" : undefined, borderBottom: theme.table === "minimal" ? "none" : "1px solid #e4e4e7", border: theme.table === "grid" ? "1px solid #d4d4d8" : undefined };

    return (
        <div ref={box} data-testid="doc-preview" className="w-full overflow-hidden rounded-xl border bg-zinc-200/60 dark:bg-zinc-800/60" style={{ height: PAGE_H * scale + 2 }}>
            <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left", background: "#fff", color: "#18181b", position: "relative", fontFamily: serif ? "Georgia, 'Times New Roman', serif" : "Inter, Helvetica, Arial, sans-serif", fontSize: 13, overflow: "hidden" }}>
                {theme.header === "sidebar" && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: css(accent) }} />}
                {st.watermark && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ transform: "rotate(-35deg)", fontSize: 110, fontWeight: 800, color: "rgba(0,0,0,0.07)", letterSpacing: 8 }}>{st.watermark}</span></div>}

                {decor && <DecorLayer d={decor} accent={accent} />}
                {decor && <DecorHeader d={decor} model={model} company={company} accent={accent} hl={hl} logo={st.showLogo !== false ? company?.logoUrl : undefined} total={formatCurrency(t.total)} quote={quote} />}

                {/* cabeçalho */}
                {!decor && <div style={{ padding: headBand ? "36px 48px 28px" : "44px 48px 8px", background: headBand ? css(accent) : undefined, color: headBand ? css(on) : undefined, textAlign: theme.header === "centered" ? "center" : undefined, marginLeft: theme.header === "sidebar" ? 14 : 0 }}>
                    <div style={{ display: "flex", justifyContent: theme.header === "centered" ? "center" : "space-between", alignItems: "flex-start", gap: 24, flexDirection: theme.header === "centered" ? "column" : "row" }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "center", flexDirection: theme.header === "centered" ? "column" : "row" }}>
                            {logo}
                            <div>
                                <div style={{ fontSize: 22, fontWeight: 800 }}>{company?.name || "A sua empresa"}</div>
                                <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>{company_.map((l, i) => <div key={i}>{l}</div>)}</div>
                            </div>
                        </div>
                        <div style={{ textAlign: theme.header === "centered" ? "center" : "right" }}>
                            <div style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", color: headBand ? undefined : css(accent) }}>{docTitle(model.type)}</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>N.º {model.number || "—"}</div>
                        </div>
                    </div>
                </div>}
                {!decor && !headBand && <div style={{ margin: "10px 48px 0", marginLeft: theme.header === "sidebar" ? 62 : 48, borderTop: theme.header === "centered" ? `3px double ${css(accent)}` : `1.5px solid ${css(accent)}` }} />}

                <div style={{ position: "relative", padding: decor ? `${mm(top)}px ${side}px 0` : "22px 48px 0", marginLeft: theme.header === "sidebar" ? 14 : 0 }}>
                    {/* datas e cliente */}
                    {showBoxes && <div style={{ display: "flex", gap: 20, marginBottom: decor === "hatch" ? 10 : 22 }}>
                        <div style={{ flex: 1, padding: 12, borderRadius: theme.boxes === "boxed" ? 6 : 0, background: theme.boxes === "boxed" ? "#f4f4f5" : undefined, borderLeft: theme.boxes === "bar" ? `4px solid ${css(accent)}` : undefined, paddingLeft: theme.boxes === "bar" ? 12 : 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: css(accent), letterSpacing: 1, marginBottom: 4 }}>DETALHES</div>
                            <div style={{ fontSize: 12, lineHeight: 1.6 }}>Data: {date(model.issueDate)}<br />{model.dueDate ? <>{quote ? "Validade" : "Vencimento"}: {date(model.dueDate)}<br /></> : null}{model.operator ? <>Operador: {model.operator}</> : null}</div>
                        </div>
                        <div style={{ flex: 1, padding: 12, borderRadius: theme.boxes === "boxed" ? 6 : 0, background: theme.boxes === "boxed" ? "#f4f4f5" : undefined, borderLeft: theme.boxes === "bar" ? `4px solid ${css(accent)}` : undefined, paddingLeft: theme.boxes === "bar" ? 12 : 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: css(accent), letterSpacing: 1, marginBottom: 4 }}>CLIENTE</div>
                            <div style={{ fontSize: 12, lineHeight: 1.6 }}><b>{model.client.name || "Consumidor Final"}</b>{[model.client.taxId && `NUIT: ${model.client.taxId}`, model.client.address, model.client.phone, model.client.email].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>
                        </div>
                    </div>}
                    {decor === "hatch" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                            <div style={{ width: "calc(50% - 10px)", background: css(accent), color: css(on), display: "flex", justifyContent: "space-between", padding: "8px 14px", fontWeight: 800 }}>
                                <span style={{ fontSize: 10.5, letterSpacing: 0.5 }}>{(quote ? "TOTAL" : "TOTAL A PAGAR")}</span><span style={{ fontSize: 14 }}>{formatCurrency(t.total)}</span>
                            </div>
                        </div>
                    )}

                    {/* artigos */}
                    <table style={{ width: decor === "ribbon" ? `calc(100% - ${mm(37)}px)` : "100%", marginLeft: decor === "ribbon" ? mm(37) : 0, borderCollapse: decor === "glass" ? "separate" : "collapse", borderSpacing: 0, border: theme.table === "grid" ? `1px solid ${css(accent)}` : undefined }}>
                        <thead><tr style={headStyle}>
                            {numbered && <th style={{ ...th, textAlign: "center", width: 44, borderRadius: center ? "18px 0 0 18px" : undefined }}>N.º</th>}
                            <th style={{ ...th, borderRight: center ? "1px solid rgb(208,211,222)" : undefined }}>Artigo / Descrição</th><th style={thR}>Qtd.</th><th style={thR}>Preço unit.</th>{items.some((i) => i.discountPct) && <th style={thR}>Desc.</th>}<th style={{ ...thR, borderRadius: center ? "0 18px 18px 0" : undefined }}>Subtotal</th>
                        </tr></thead>
                        <tbody>
                            {(items.length ? items : [{ id: "x", description: "", quantity: 0, unit: "", unitPrice: 0 }]).map((i, n) => (
                                <tr key={i.id} style={rowStyle(n)}>
                                    {numbered && <td style={{ ...td, textAlign: "center", fontWeight: decor === "ribbon" ? 700 : undefined, background: decor === "swirl" ? (n % 2 ? "rgb(214,219,228)" : "rgb(229,233,239)") : undefined }}>{decor === "ribbon" ? `# ${n + 1}.` : n + 1}</td>}
                                    <td style={{ ...td, textAlign: center ? "center" : "left", whiteSpace: undefined, fontWeight: decor === "swirl" || decor === "atelier" ? 700 : undefined, textTransform: decor === "atelier" ? "uppercase" : undefined, fontSize: decor === "atelier" ? 11.5 : td.fontSize }}>
                                        {decor === "atelier" && <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: css(accent), marginRight: 10, verticalAlign: "middle" }} />}
                                        {i.description || <span style={{ color: "#a1a1aa" }}>—</span>}
                                    </td>
                                    <td style={td}>{i.quantity} {i.unit}</td>
                                    <td style={td}>{formatCurrency(i.unitPrice)}</td>
                                    {items.some((x) => x.discountPct) && <td style={td}>{i.discountPct ? `${i.discountPct}%` : ""}</td>}
                                    <td style={{ ...td, fontWeight: 600 }}>{formatCurrency(itemSubtotal(i))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* totais */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                        <div style={{ width: 280, fontSize: 12.5 }}>
                            <Row l="Subtotal" v={formatCurrency(t.subtotal)} />
                            {t.discount > 0 && <Row l="Desconto" v={`-${formatCurrency(t.discount)}`} />}
                            {t.vat > 0 && <Row l={`IVA${model.vatPct ? ` (${model.vatPct}%)` : ""}`} v={formatCurrency(t.vat)} />}
                            <div style={{ marginTop: 6, padding: theme.totals === "block" ? "10px 12px" : "8px 0 0", background: theme.totals === "block" ? css(accent) : undefined, color: theme.totals === "block" ? css(on) : decor === "poster" ? "#18181b" : css(accent), borderTop: theme.totals === "line" && decor !== "poster" ? `2px solid ${css(accent)}` : undefined, borderBottom: decor === "poster" ? `4px solid ${css(hl)}` : undefined, paddingBottom: decor === "poster" ? 8 : undefined, borderRadius: theme.totals === "block" ? (decor === "ribbon" ? 0 : decor === "glass" ? 14 : 6) : 0, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800 }}>
                                <span>{quote ? "Total" : "Total a pagar"}</span><span>{formatCurrency(t.total)}</span>
                            </div>
                        </div>
                    </div>

                    {(model.notes || model.paymentTerms || model.paymentMethod) && (
                        <div style={{ marginTop: 18, fontSize: 11.5, lineHeight: 1.6, color: "#3f3f46" }}>
                            {model.paymentMethod && <div><b>Pagamento:</b> {model.paymentMethod}</div>}
                            {model.paymentTerms && <div><b>Condições:</b> {model.paymentTerms}</div>}
                            {model.notes && <div><b>Notas:</b> {model.notes}</div>}
                        </div>
                    )}

                    {st.showSignatures !== false && st.signaturePlace && <div style={{ marginTop: 24, fontSize: 10, color: "#71717a", textAlign: st.showClientSignature ? "left" : "center" }}>{st.signaturePlace}, {date(model.issueDate)}</div>}
                    {st.showSignatures !== false && (
                        <div style={{ display: "flex", gap: 60, marginTop: st.signaturePlace ? 12 : 56, padding: st.showClientSignature ? "0 20px" : "0 32%" }}>
                            {[{ l: "A EMPRESA", s: st.companySignature || company?.signatureUrl }, ...(st.showClientSignature ? [{ l: "O CLIENTE", s: st.clientSignature }] : [])].map((x, k) => x.l ? (
                                <div key={x.l} style={{ flex: 1, textAlign: "center" }}>
                                    <div style={{ height: 56, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>{x.s && <img src={x.s} alt="" style={{ maxHeight: 54, maxWidth: "100%" }} />}</div>
                                    <div style={{ borderTop: "1px solid #71717a", paddingTop: 4, fontSize: 9, color: "#71717a", letterSpacing: 1 }}>{x.l}</div>
                                </div>
                            ) : <div key={k} style={{ flex: 1 }} />)}
                        </div>
                    )}
                </div>

                {decor ? <DecorFooter d={decor} text={st.footerNote?.trim() || `${company?.name || "MajorStockX"} © ${new Date().getFullYear()} · Processado por computador (MajorStockX)`} accent={accent} hl={hl} company={company} /> : (
                    <div style={{ position: "absolute", left: 48, right: 48, bottom: 28, borderTop: "1px solid #e4e4e7", paddingTop: 6, fontSize: 9.5, color: "#71717a", display: "flex", justifyContent: "space-between" }}>
                        <span>{company?.name}{st.footerNote ? ` · ${st.footerNote}` : ""}</span><span>Pág. 1</span>
                    </div>
                )}
            </div>
        </div>
    );
}

const Row = ({ l, v }: { l: string; v: string }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#52525b" }}><span>{l}</span><span>{v}</span></div>;
export const accentOf = (hex?: string, fallback: RGB = [24, 24, 27]) => rgbToHex(hexToRgb(hex) || fallback);

// ---------- temas com desenho próprio: as mesmas formas e medidas do PDF (lib/doc-pdf.ts), em milímetros ----------

/** As formas de cor (ondas, faixas, moldura…) por trás do conteúdo. */
/** Caminho SVG de um DecorPath, com os pontos transformados por f. */
const svgPath = ([start, steps]: DecorPath, f: (x: number, y: number) => [number, number] = (x, y) => [x, y]) =>
    `M${f(...start).join(" ")} ` + steps.map((st) => (st.length === 2 ? "L" : "C") + st.flatMap((_, i) => (i % 2 ? [] : f(st[i], st[i + 1]))).join(" ")).join(" ") + " Z";

function DecorLayer({ d, accent }: { d: DocDecor; accent: RGB }) {
    const a = css(accent), t = (k: number) => css(tint(accent, k));
    // Maré: camada clara, contorno branco (a onda escura desviada) e a onda escura; no rodapé, espelhadas e mais baixas
    const swirl = (f: (x: number, y: number) => [number, number]) => <>
        <path d={svgPath(SWIRL_LIGHT, f)} fill="rgb(226,231,238)" />
        <path d={svgPath(SWIRL_NAVY, (x, y) => { const [u, v] = f(x, y); return [u + (u > 105 ? -1.6 : 1.6), v + (v > 148.5 ? -1.6 : 1.6)]; })} fill="#fff" />
        <path d={svgPath(SWIRL_NAVY, f)} fill={a} />
    </>;
    return (
        <svg viewBox="0 0 210 297" width={PAGE_W} height={PAGE_H} style={{ position: "absolute", inset: 0 }} aria-hidden>
            <defs>
                <pattern id="hatch" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="2.2" stroke="rgb(205,205,214)" strokeWidth="0.3" />
                </pattern>
            </defs>
            {d === "wave" && <>
                <path d="M0 0 L210 0 L210 24 C130.2 30 63 96 0 88 Z" fill={t(0.86)} />
                <path d="M0 0 L134.4 0 C96.6 10 79.8 62 0 72 Z" fill={a} />
                <path d="M58.8 297 C130.2 293 178.5 277 210 273 L210 297 Z" fill={t(0.86)} />
                <path d="M115.5 297 C163.8 294 193.2 285 210 282 L210 297 Z" fill={a} />
            </>}
            {d === "card" && <>
                <rect x="0" y="0" width="210" height="74" fill={a} />
                <circle cx="202" cy="-6" r="46" fill={t(0.12)} />
                <circle cx="168" cy="62" r="18" fill={t(0.2)} />
                <rect x="15.9" y="64.4" width="180" height="15" rx="4" fill="rgb(205,208,216)" />
                <rect x="15" y="63" width="180" height="15" rx="4" fill="#fff" />
                <rect x="33" y="277" width="144" height="8" rx="4" fill={a} />
            </>}
            {d === "frame" && <>
                <rect x="0" y="0" width="210" height="78" fill={a} />
                <rect x="0" y="78" width="12" height="219" fill={a} />
                <rect x="198" y="78" width="12" height="219" fill={a} />
                <rect x="0" y="283" width="210" height="14" fill={a} />
            </>}
            {d === "stripes" && <>
                <rect x="0" y="0" width="210" height="14" fill={css(CHARCOAL)} />
                <polygon points="0,0 46,0 36,14 0,14" fill={a} />
                <polygon points="50,0 58,0 48,14 40,14" fill={t(0.35)} />
                <polygon points="62,0 66,0 56,14 52,14" fill={a} />
                <rect x="115.5" y="14" width="94.5" height="1.3" fill={a} />
                <rect x="0" y="285" width="210" height="12" fill={css(CHARCOAL)} />
                <polygon points="170,285 210,285 210,297 162,297" fill={a} />
                <polygon points="158,285 164,285 156,297 150,297" fill={t(0.35)} />
            </>}
            {d === "hatch" && <>
                <rect x="0" y="0" width="210" height="10" fill="url(#hatch)" />
                <rect x="105" y="10" width="105" height="0.9" fill={a} />
                <rect x="0" y="289" width="210" height="8" fill="url(#hatch)" />
                <rect x="0" y="288.1" width="105" height="0.9" fill={a} />
            </>}
            {d === "corner" && <>
                <polygon points="112,0 210,0 210,80" fill={t(0.8)} />
                <polygon points="142,0 210,0 210,56" fill={a} />
                <polygon points="0,267 55,297 0,297" fill={t(0.8)} />
                <polygon points="0,277 38,297 0,297" fill={a} />
            </>}
            {d === "glass" && <>
                <rect x="0" y="0" width="210" height="50" fill={a} />
                <rect x="0" y="0" width="210" height="86" rx="14" fill={a} />
                <circle cx="128" cy="-22" r="40" fill={t(0.1)} />
                <circle cx="-6" cy="52" r="18" fill={t(0.07)} />
                <rect x="22" y="284" width="166" height="20" rx="6" fill={a} />
            </>}
            {d === "poster" && <>
                <rect x="0" y="0" width="210" height="297" fill={a} />
                <rect x="13" y="86.5" width="184" height="210.5" fill="#fff" />
                <rect x="21" y="285" width="168" height="12" fill={a} />
            </>}
            {d === "atelier" && <>
                <rect x="0" y="0" width="210" height="297" fill="url(#hatch)" />
                <rect x="15" y="43.4" width="180" height="34" fill="#fff" />
                <rect x="15" y="273.75" width="180" height="0.5" fill={a} />
                <rect x="15" y="274.4" width="180" height="13" fill="#fff" />
            </>}
            {d === "ribbon" && <>
                <rect x="0" y="0" width="210" height="11" fill={css(INK)} />
                <polygon points="128,11 210,11 210,25 140,25" fill={css(INK)} />
                <polygon points="0,0 70,0 63,6.5 0,6.5" fill={a} />
                <polygon points="73,0 79,0 72,6.5 66,6.5" fill={t(0.45)} />
                <polygon points="112,11 122,11 134,25 124,25" fill={a} />
                <polygon points="106,11 109,11 121,25 118,25" fill={t(0.45)} />
                <rect x="0" y="288" width="210" height="9" fill={css(INK)} />
                <polygon points="112,288 210,288 210,284 116,284" fill={css(INK)} />
                <polygon points="0,297 64,297 70,291.5 0,291.5" fill={a} />
                <polygon points="67,297 73,297 79,291.5 73,291.5" fill={t(0.45)} />
                <polygon points="90,288 100,288 104,284 94,284" fill={a} />
            </>}
            {d === "swirl" && <>
                {swirl((x, y) => [x, y])}
                {swirl((x, y) => [210 - x, 297 - y * SWIRL_FOOT])}
            </>}
            {d === "circles" && <>
                <circle cx="204" cy="2" r="44" fill={t(0.86)} />
                <circle cx="164" cy="-8" r="22" fill={t(0.6)} />
                <circle cx="207" cy="44" r="15" fill={a} />
                <circle cx="8" cy="303" r="30" fill={t(0.86)} />
                <circle cx="32" cy="305" r="13" fill={t(0.6)} />
                <circle cx="54" cy="300" r="6" fill={a} />
            </>}
        </svg>
    );
}

/** Texto posicionado como no PDF: (x, y) em mm, y na linha de base, tamanho em pontos. */
function T({ x, y, size, bold, italic, color, align = "left", spacing, max, children }: { x: number; y: number; size: number; bold?: boolean; italic?: boolean; color: string; align?: "left" | "right" | "center"; spacing?: number; max?: number; children: React.ReactNode }) {
    const px = pt(size);
    const pos: React.CSSProperties = align === "right" ? { right: PAGE_W - mm(x) } : align === "center" ? { left: mm(x), transform: "translateX(-50%)" } : { left: mm(x) };
    return (
        <div style={{ position: "absolute", top: mm(y) - px * 0.82, ...pos, fontSize: px, lineHeight: 1, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : undefined, color, whiteSpace: "nowrap", letterSpacing: spacing, maxWidth: max ? mm(max) : undefined, overflow: "hidden", textOverflow: "ellipsis", textAlign: align }}>
            {children}
        </div>
    );
}

function DecorHeader({ d, model, company, accent, hl, logo, total, quote }: { d: DocDecor; model: DocModel; company: Company | null; accent: RGB; hl: RGB; logo?: string; total: string; quote: boolean }) {
    const on = readableOn(accent);
    const onC = css(on), sub = css(tint(on, on[0] === 255 ? 0.22 : 0.35)), dark = "#18181b", grey = "#71717a", acc = css(accent);
    const title = docTitle(model.type), titleU = title.toUpperCase(), num = `N.º ${model.number || "—"}`;
    const lines = [company?.address, company?.taxId ? `NUIT: ${company.taxId}` : "", [company?.phone, company?.email].filter(Boolean).join(" · ")].filter(Boolean) as string[];
    const client = [model.client.taxId ? `NUIT: ${model.client.taxId}` : "", model.client.address || "", [model.client.phone, model.client.email].filter(Boolean).join(" · ")].filter(Boolean);
    const Logo = ({ x, y, w, h, white }: { x: number; y: number; w: number; h: number; white?: boolean }) => logo ? (
        <div style={{ position: "absolute", left: mm(x), top: mm(y), width: mm(w), height: mm(h), display: "flex", alignItems: "center", background: white ? "#fff" : undefined, borderRadius: 4, padding: white ? 3 : 0 }}>
            <img src={logo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
    ) : null;
    const tx = logo ? 46 : 15;
    const Company = ({ x, y, c, s, max }: { x: number; y: number; c: string; s: string; max: number }) => <>
        <T x={x} y={y + 6} size={15} bold color={c} max={max}>{company?.name || "A sua empresa"}</T>
        {lines.map((l, i) => <T key={i} x={x} y={y + 11 + i * 3.8} size={8.5} color={s} max={max}>{l}</T>)}
    </>;
    if (d === "wave") return <>
        <Logo x={15} y={11} w={26} h={15} white />
        <Company x={tx} y={9} c={onC} s={sub} max={74 - (tx - 15)} />
        <T x={195} y={21} size={22} bold color={acc} align="right">{titleU}</T>
        <T x={195} y={28} size={10.5} color={grey} align="right">{num}</T>
    </>;
    if (d === "card") return <>
        <Logo x={15} y={11} w={26} h={15} white />
        <Company x={tx} y={9} c={onC} s={sub} max={100 - (tx - 15)} />
        <T x={195} y={19} size={20} bold color={onC} align="right">{titleU}</T>
        <T x={195} y={26} size={10.5} color={onC} align="right">{num}</T>
        <T x={15} y={40} size={7.5} color={sub}>{quote ? "PROPOSTA PARA" : "FATURADO A"}</T>
        <T x={15} y={46.5} size={12.5} bold color={onC} max={95}>{model.client.name || "Consumidor Final"}</T>
        {client.slice(0, 3).map((l, i) => <T key={i} x={15} y={51.5 + i * 4} size={8.5} color={sub} max={95}>{l}</T>)}
        <T x={model.dueDate ? 165 : 195} y={40} size={7.5} color={sub} align="right">DATA</T>
        <T x={model.dueDate ? 165 : 195} y={46.5} size={10.5} bold color={onC} align="right">{date(model.issueDate)}</T>
        {model.dueDate && <><T x={195} y={40} size={7.5} color={sub} align="right">{quote ? "VÁLIDA ATÉ" : "VENCIMENTO"}</T><T x={195} y={46.5} size={10.5} bold color={onC} align="right">{date(model.dueDate)}</T></>}
    </>;
    if (d === "frame") return <>
        <div style={{ position: "absolute", left: mm(20), top: mm(12), height: mm(8), padding: `0 ${mm(4)}px`, background: css(hl), display: "flex", alignItems: "center", fontSize: pt(9), fontWeight: 700, letterSpacing: 3, color: dark }}>{titleU}</div>
        <T x={20} y={27} size={8.5} color={sub}>{num}</T>
        <T x={20} y={31} size={8.5} color={sub}>Data: {date(model.issueDate)}{model.dueDate ? ` · ${quote ? "Válida até" : "Vencimento"}: ${date(model.dueDate)}` : ""}</T>
        <T x={20} y={41} size={7.5} color={sub}>{quote ? "PROPOSTA PARA" : "FATURADO A"}</T>
        <T x={20} y={48} size={15} bold color={onC} max={100}>{model.client.name || "Consumidor Final"}</T>
        {client.slice(0, 3).map((l, i) => <T key={i} x={20} y={53.5 + i * 4} size={8.5} color={sub} max={100}>{l}</T>)}
        <div style={{ position: "absolute", left: mm(20), top: mm(67), width: mm(70), borderTop: `1px solid ${sub}` }} />
        <T x={190} y={16} size={12} bold color={onC} align="right">{company?.name || "A sua empresa"}</T>
        {lines.map((l, i) => <T key={i} x={190} y={20.5 + i * 3.6} size={7.5} color={sub} align="right" max={70}>{l}</T>)}
        <T x={190} y={55} size={10} color={onC} align="right">{quote ? "Total" : "Total a pagar"}</T>
        <T x={190} y={64} size={20} bold color={css(hl)} align="right">{total}</T>
    </>;
    if (d === "stripes") return <>
        <Logo x={15} y={21} w={28} h={16} />
        <Company x={logo ? 47 : 15} y={20} c={dark} s={grey} max={100} />
        <T x={195} y={33} size={20} bold color={css(CHARCOAL)} align="right" spacing={4}>{titleU}</T>
        <T x={195} y={40} size={10.5} color={acc} align="right">{num}</T>
    </>;
    if (d === "hatch") return <>
        {logo ? <Logo x={15} y={17} w={26} h={15} /> : (
            <div style={{ position: "absolute", left: mm(15), top: mm(18), width: mm(14), height: mm(14), borderRadius: "50%", background: acc, color: onC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pt(9), fontWeight: 700 }}>
                {initials(company?.name || "M")}
            </div>
        )}
        <Company x={logo ? 45 : 33} y={17} c={dark} s={grey} max={90} />
        <div style={{ position: "absolute", right: PAGE_W - mm(195), top: mm(18), width: mm(62), borderTop: `3px solid ${acc}` }} />
        <T x={195} y={31} size={24} bold color={dark} align="right"><span style={{ color: acc }}>.</span>{title}</T>
        <T x={195} y={38} size={10.5} color={grey} align="right">{num}</T>
        <div style={{ position: "absolute", left: mm(15), right: PAGE_W - mm(195), top: mm(48), borderTop: `2px solid ${acc}` }} />
        <div style={{ position: "absolute", left: mm(15), right: PAGE_W - mm(195), top: mm(49.2), borderTop: "1px solid #e4e4e7" }} />
    </>;
    const name = company?.name || "A sua empresa";
    const lightOn = css(tint(accent, 0.62)), lighterOn = css(tint(accent, 0.72));
    if (d === "glass") {
        const gx = logo ? 53 : 33;
        return <>
            {logo ? <Logo x={22} y={10} w={26} h={14} white /> : (
                <div style={{ position: "absolute", left: mm(22.25), top: mm(12.25), display: "grid", gridTemplateColumns: `repeat(3, ${mm(1.5)}px)`, gap: mm(1.3) }}>
                    {Array.from({ length: 9 }, (_, k) => <span key={k} style={{ width: mm(1.5), height: mm(1.5), borderRadius: "50%", background: css(hl) }} />)}
                </div>
            )}
            <T x={gx} y={17.5} size={16} bold color={onC} max={100 - (gx - 22)}>{name.toUpperCase()}</T>
            {company?.address && <T x={gx} y={21.5} size={7} color={sub} spacing={1} max={90 - (gx - 22)}>{company.address.toUpperCase()}</T>}
            <T x={144} y={16} size={9} bold color={onC}>CONTACTOS</T>
            {lines.map((l, i) => <T key={i} x={144} y={21 + i * 3.6} size={7.5} color={sub} max={44}>{l}</T>)}
            <T x={22} y={35} size={17} bold color={onC}>{titleU}<span style={{ fontSize: pt(10), fontWeight: 400, color: sub, marginLeft: mm(4) }}>{num}</span></T>
            <T x={22} y={46} size={9} color={sub}>{quote ? "Proposta para" : "Faturado a"}</T>
            <T x={22} y={52} size={11.5} bold color={onC} max={100}>{model.client.name || "Consumidor Final"}</T>
            {client.slice(0, 2).map((l, i) => <T key={i} x={22} y={57 + i * 4} size={8.5} color={sub} max={100}>{l}</T>)}
            <T x={144} y={46} size={9} color={sub}>Data</T>
            <T x={144} y={52} size={10.5} bold color={onC}>{date(model.issueDate)}</T>
            {model.dueDate && <><T x={174} y={46} size={9} color={sub}>{quote ? "Válida até" : "Vencimento"}</T><T x={174} y={52} size={10.5} bold color={onC}>{date(model.dueDate)}</T></>}
        </>;
    }
    if (d === "poster") {
        const meta: [string, string][] = [[`${title} n.º`, model.number || "—"], ["Data", date(model.issueDate)], ...(model.dueDate ? [[quote ? "Válida até" : "Vencimento", date(model.dueDate)] as [string, string]] : [])];
        const ty = logo ? 32 : 20;
        return <>
            <div style={{ position: "absolute", left: mm(21), top: mm(13), height: mm(8.5), padding: `0 ${mm(4.5)}px`, background: css(hl), display: "flex", alignItems: "center", fontSize: pt(9), fontWeight: 700, letterSpacing: mm(1.4), color: css(readableOn(hl)) }}>{titleU}</div>
            <T x={21} y={31} size={9} color={sub}>{quote ? "Proposta para" : "Faturado a"}</T>
            <T x={21} y={38.5} size={17} bold color={onC} max={100}>{model.client.name || "Consumidor Final"}</T>
            {client.slice(0, 2).map((l, i) => <T key={i} x={21} y={44 + i * 4} size={8.5} color={sub} max={100}>{l}</T>)}
            <div style={{ position: "absolute", left: mm(21), top: mm(54), width: mm(62), borderTop: `1px solid ${onC}` }} />
            {meta.map(([k, v], i) => <div key={k}><T x={21} y={61 + i * 5} size={8.5} color={onC}>{k}</T><T x={49} y={61 + i * 5} size={8.5} color={onC}>:&nbsp; {v}</T></div>)}
            {logo && <Logo x={159} y={9} w={30} h={14} white />}
            <T x={189} y={ty} size={14} bold color={lightOn} align="right" max={92}>{name.toUpperCase()}</T>
            {lines.map((l, i) => <T key={i} x={189} y={ty + 5.5 + i * 3.6} size={7.5} color={lighterOn} align="right" max={80}>{l}</T>)}
            <T x={189} y={58} size={15} color={onC} align="right">{quote ? "Total" : "Total a pagar"}</T>
            <T x={189} y={67.5} size={21} bold color={css(hl)} align="right">{total}</T>
        </>;
    }
    if (d === "atelier") {
        const det: [string, string][] = [[`${title} N.º`, model.number || "—"], ["Data", date(model.issueDate)], ...(model.dueDate ? [[quote ? "Válida até" : "Vencimento", date(model.dueDate)] as [string, string]] : model.paymentMethod ? [["Pagamento", model.paymentMethod] as [string, string]] : [])];
        return <>
            {logo ? <Logo x={22} y={8} w={30} h={14} /> : (
                <div style={{ position: "absolute", left: mm(30.5), top: mm(8.5), width: mm(13), height: mm(13), borderRadius: "50%", background: acc, color: onC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pt(9), fontWeight: 700 }}>{initials(name)}</div>
            )}
            <div style={{ position: "absolute", left: mm(14), width: mm(46), top: mm(25), textAlign: "center", fontSize: pt(12.5), fontWeight: 700, lineHeight: `${mm(5)}px`, color: dark }}>
                {name}
                {company?.taxId && <div style={{ fontSize: pt(6.5), fontWeight: 400, color: grey, letterSpacing: 2, lineHeight: 1.4 }}>NUIT {company.taxId}</div>}
            </div>
            <div style={{ position: "absolute", left: mm(65), right: PAGE_W - mm(195), top: mm(10), borderTop: `3px solid ${acc}` }} />
            <div style={{ position: "absolute", left: mm(65), right: PAGE_W - mm(195), top: mm(11.6), borderTop: `1px solid ${acc}` }} />
            {[company?.address, company?.phone, company?.email].filter(Boolean).map((l, i) => <T key={i} x={65} y={18 + i * 3.6} size={7.5} color={grey} max={58}>{l}</T>)}
            <T x={195} y={27} size={24} bold color={dark} align="right"><span style={{ color: acc }}>.</span>{title}</T>
            <T x={195} y={34} size={10.5} color={grey} align="right">{num}</T>
            <div style={{ position: "absolute", left: mm(15), right: PAGE_W - mm(195), top: mm(43), borderTop: `2px solid ${acc}` }} />
            <div style={{ position: "absolute", left: mm(105), top: mm(45), height: mm(31), borderLeft: "1px solid rgb(205,205,214)" }} />
            <T x={17} y={49.5} size={7.5} bold color={acc}>{quote ? "PROPOSTA PARA:" : "FATURADO A:"}</T>
            <T x={109} y={49.5} size={7.5} bold color={acc}>DETALHES:</T>
            <div style={{ position: "absolute", left: mm(17.1), top: mm(54.3), width: mm(2.6), height: mm(2.6), borderRadius: "50%", background: acc }} />
            <T x={21.5} y={56.8} size={10.5} bold color={dark} spacing={2} max={78}>{(model.client.name || "Consumidor Final").toUpperCase()}</T>
            {client.slice(0, 3).map((l, i) => <T key={i} x={21.5} y={62.5 + i * 4.2} size={8} color={grey} max={80}>{l}</T>)}
            {det.map(([k, v], i) => <div key={k}><T x={109} y={55.5 + i * 4.4} size={8} color={grey}>{k.toUpperCase()}</T><T x={137} y={55.5 + i * 4.4} size={8} color={grey}>:</T><T x={192} y={55.5 + i * 4.4} size={8} color={dark} align="right">{v}</T></div>)}
            <div style={{ position: "absolute", left: mm(105), top: mm(68.5), width: mm(90), height: mm(8.5), background: acc, color: onC, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${mm(3)}px 0 ${mm(4)}px`, fontWeight: 700 }}>
                <span style={{ fontSize: pt(7.5) }}>{quote ? "TOTAL" : "TOTAL A PAGAR"} :</span><span style={{ fontSize: pt(11.5) }}>{total}</span>
            </div>
            <div style={{ position: "absolute", left: mm(15), right: PAGE_W - mm(195), top: mm(77.6), borderTop: `2px solid ${acc}` }} />
        </>;
    }
    if (d === "ribbon") {
        const cols: [string, string][] = [[quote ? "Proposta para" : "Cliente", model.client.name || "Consumidor Final"], ["NUIT do cliente", model.client.taxId || "—"], ["Data", date(model.issueDate)], ...(model.dueDate ? [[quote ? "Válida até" : "Vencimento", date(model.dueDate)] as [string, string]] : [])];
        const xs = [15, 77, 119, 157];
        const info = ([["Morada", company?.address], ["NUIT", company?.taxId], ["Telefone", company?.phone], ["Email", company?.email], [quote ? "" : "Pagamento", quote ? "" : model.paymentMethod]] as [string, string | undefined][]).filter(([k, v]) => k && v);
        const nx = logo ? 45 : 30;
        return <>
            {logo ? <Logo x={15} y={16} w={26} h={14} /> : (
                <div style={{ position: "absolute", left: mm(15.8), top: mm(15.5), width: mm(10.4), height: mm(12), background: acc, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", color: onC, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pt(8), fontWeight: 700 }}>{initials(name)}</div>
            )}
            <T x={nx} y={21} size={14} bold color={css(INK)} max={92 - (nx - 15)}>{name.toUpperCase()}</T>
            {company?.address && <T x={nx} y={25.5} size={7.5} color={grey} spacing={1} max={80 - (nx - 15)}>{company.address}</T>}
            <T x={195} y={39} size={19} bold color={css(INK)} align="right" spacing={mm(2.6)}><span style={{ marginRight: -mm(2.6) }}>{titleU}</span></T>
            <T x={195} y={44.5} size={9} color={acc} align="right">{num}</T>
            {cols.map(([k, v], i) => <div key={k}>
                <div style={{ position: "absolute", left: mm(xs[i]), top: mm(49), width: mm(0.8), height: mm(10), background: acc }} />
                <T x={xs[i] + 3} y={52.6} size={7.5} color={dark}>{k}</T>
                <T x={xs[i] + 3} y={57.6} size={9.5} bold color={i === 0 ? acc : dark} max={(xs[i + 1] ?? 195) - xs[i] - 6}>{v}</T>
            </div>)}
            <div style={{ position: "absolute", left: mm(15), top: mm(63), width: mm(33), minHeight: mm(40), background: "rgb(226,227,231)", padding: `${mm(3)}px ${mm(3)}px`, fontSize: pt(7.5), lineHeight: 1.3 }}>
                {info.map(([k, v]) => <div key={k} style={{ marginBottom: mm(2.6) }}><div style={{ color: acc, fontWeight: 700 }}>{k}</div><div style={{ color: dark, wordBreak: "break-word" }}>{v}</div></div>)}
            </div>
        </>;
    }
    if (d === "swirl") {
        const meta: [string, string][] = [[`${title} n.º`, model.number || "—"], ["Data", date(model.issueDate)], ...(model.dueDate ? [[quote ? "Válida até" : "Vencimento", date(model.dueDate)] as [string, string]] : [])];
        const nx = logo ? 46 : 28;
        return <>
            {logo ? <Logo x={15} y={11} w={26} h={14} white /> : <>
                <div style={{ position: "absolute", left: mm(15), top: mm(12), width: mm(6), height: mm(6), border: "3px solid #fff" }} />
                <div style={{ position: "absolute", left: mm(18), top: mm(15), width: mm(6), height: mm(6), border: "3px solid #fff" }} />
            </>}
            <T x={nx} y={17} size={13.5} bold color="#fff" max={76 - (nx - 15)}>{name.toUpperCase()}</T>
            {company?.address && <T x={nx} y={21.5} size={7.5} color="rgb(214,224,236)" max={70 - (nx - 15)}>{company.address}</T>}
            <T x={128} y={21} size={17} bold color={acc}>{titleU}</T>
            {meta.map(([k, v], i) => <div key={k}><T x={128} y={28 + i * 4.4} size={7.5} color={grey}>{k}</T><T x={152} y={28 + i * 4.4} size={7.5} color={grey}>:</T><T x={155} y={28 + i * 4.4} size={7.5} color={acc}>{v}</T></div>)}
            <T x={128} y={46} size={7.5} bold color={acc}>{quote ? "PROPOSTA PARA" : "FATURADO A"}</T>
            <T x={128} y={51.5} size={10} bold color={dark} max={67}>{model.client.name || "Consumidor Final"}</T>
            {client.slice(0, 2).map((l, i) => <T key={i} x={128} y={56 + i * 3.8} size={7.5} color="#52525b" max={67}>{l}</T>)}
        </>;
    }
    // corner e circles: empresa em cima, título grande à esquerda
    return <>
        <Logo x={15} y={14} w={28} h={16} />
        <Company x={logo ? 47 : 15} y={13} c={dark} s={grey} max={90} />
        <T x={15} y={41} size={26} bold color={acc}>{d === "corner" ? titleU : title}</T>
        <T x={15} y={48} size={10.5} color={grey}>{num}</T>
    </>;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

function DecorFooter({ d, text, accent, hl, company }: { d: DocDecor; text: string; accent: RGB; hl: RGB; company: Company | null }) {
    const on = css(readableOn(accent)), grey = "#71717a", acc = css(accent), dark = "#18181b";
    if (d === "glass") return <><T x={105} y={280} size={7.5} color={grey} align="center" max={160}>{text}</T><T x={105} y={292} size={9} color={on} align="center">Obrigado pela preferência!</T></>;
    if (d === "poster") return <><T x={21} y={281.5} size={7.5} color={grey} max={160}>{text}</T><T x={105} y={292.2} size={9} italic color={css(hl)} align="center">Obrigado pela preferência!</T></>;
    if (d === "atelier") {
        const c1 = [company?.email, company?.phone].filter(Boolean) as string[];
        const c2 = [company?.address, company?.taxId ? `NUIT ${company.taxId}` : ""].filter(Boolean) as string[];
        return <>
            {c1.map((l, i) => <T key={l} x={17} y={279.5 + i * 3.6} size={7} color={grey} max={52}>{l}</T>)}
            {c2.map((l, i) => <T key={l} x={77} y={279.5 + i * 3.6} size={7} color={grey} max={60}>{l}</T>)}
            <div style={{ position: "absolute", left: mm(143), top: mm(277), width: mm(46), fontSize: pt(7), lineHeight: 1.3, color: grey }}>{text}</div>
            <div style={{ position: "absolute", left: mm(185.4), top: mm(276.4), width: mm(9.2), height: mm(9.2), borderRadius: "50%", background: acc, color: on, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pt(6.5), fontWeight: 700 }}>{initials(company?.name || "M")}</div>
        </>;
    }
    if (d === "ribbon") return <>
        <T x={105} y={264} size={8} bold color={grey} align="center" spacing={3}>OBRIGADO PELA PREFERÊNCIA</T>
        {([company?.address, company?.email, company?.phone].filter(Boolean) as string[]).map((l, i) => <div key={l}>
            <div style={{ position: "absolute", left: mm(15 + i * 62), top: mm(269.4), width: mm(4.6), height: mm(4), background: acc, transform: "skewX(-14deg)" }} />
            <T x={21.5 + i * 62} y={272.4} size={7.5} color={dark} max={54}>{l}</T>
        </div>)}
        <T x={15} y={281.5} size={6.5} color={grey} max={170}>{text}</T>
    </>;
    if (d === "swirl") return <>
        <div style={{ position: "absolute", left: mm(15), top: mm(260), width: mm(0.9), height: mm(17), background: acc }} />
        <T x={19} y={263.5} size={8.5} bold color={acc}>CONTACTE-NOS</T>
        {([company?.address, company?.phone, company?.email].filter(Boolean) as string[]).map((l, i) => <T key={l} x={19} y={268 + i * 3.8} size={7.5} bold color={dark} max={52}>{l}</T>)}
        <T x={195} y={284} size={10} bold color="#fff" align="right">Obrigado pela preferência!</T>
        <T x={195} y={289} size={6.5} color="rgb(214,224,236)" align="right" max={80}>{text}</T>
    </>;
    if (d === "card") return <><T x={105} y={282.2} size={8.5} bold color={on} align="center">Obrigado pela preferência!</T><T x={105} y={291} size={7.5} color={grey} align="center" max={170}>{text}</T></>;
    if (d === "frame") return <><T x={20} y={279.5} size={7.5} color={grey} max={150}>{text}</T><T x={105} y={291.5} size={9} italic color={css(hl)} align="center">Obrigado pela preferência!</T></>;
    if (d === "stripes") return <T x={15} y={292.4} size={7.5} color="rgb(230,230,235)" max={130}>{text}</T>;
    if (d === "hatch") return <T x={15} y={285.5} size={7.5} color={grey} max={160}>{text}</T>;
    if (d === "corner" || d === "circles") return <T x={195} y={288.5} size={7.5} color={grey} align="right" max={130}>{text}</T>;
    return <T x={15} y={288.5} size={7.5} color={grey} max={120}>{text}</T>;
}
