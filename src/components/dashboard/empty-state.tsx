"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ImagePlus, Loader2, PackagePlus, Users, Zap, X } from "lucide-react";
import { getAuth } from "firebase/auth";
import { InventoryContext } from "@/context/inventory-context";
import { uploadProductImage } from "@/lib/upload-product-image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { GettingStartedCard } from "@/components/onboarding/getting-started-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Details = { name: string; taxId: string; phone: string; address: string; logoUrl: string };

function StepBadge({ icon: Icon, done }: { icon: React.ElementType; done: boolean }) {
    return (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
            {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
    );
}

/**
 * Primeiros passos: o que se vê quando a empresa ainda não tem produtos.
 * 1) dados da empresa (nome, NUIT, contactos, logótipo — aparecem nos documentos), 2) produtos, 3) primeira venda.
 */
export function EmptyStateWelcome() {
    const inv = useContext(InventoryContext);
    const { toast } = useToast();
    const { user, companyId, companyData, updateCompany, products, catalogProducts } = inv || ({} as any);
    const canEditCompany = user?.role === "Admin" || user?.role === "Dono";

    const [details, setDetails] = useState<Details>({ name: "", taxId: "", phone: "", address: "", logoUrl: "" });
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!companyData) return;
        setDetails({
            name: companyData.name || "",
            taxId: companyData.taxId || "",
            phone: companyData.phone || "",
            address: companyData.address || "",
            logoUrl: companyData.logoUrl || "",
        });
    }, [companyData]);

    // o NUIT é opcional: basta um contacto
    const profileDone = !!(companyData?.phone || companyData?.address);
    const productsDone = (products?.length || 0) > 0 || (catalogProducts?.length || 0) > 0;

    const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) => setDetails((d) => ({ ...d, [k]: e.target.value }));

    const uploadLogo = async (file: File) => {
        setUploading(true);
        try {
            // Vercel Blob (o Firebase Storage não funciona no plano gratuito)
            const url = await uploadProductImage(file, getAuth(), companyId);
            setDetails((d) => ({ ...d, logoUrl: url }));
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível enviar o logótipo", description: e.message });
        } finally {
            setUploading(false);
        }
    };

    const save = async () => {
        if (!updateCompany) return;
        setSaving(true);
        try {
            await updateCompany({ taxId: details.taxId.trim(), phone: details.phone.trim(), address: details.address.trim(), logoUrl: details.logoUrl });
            toast({ title: "Dados da empresa guardados" });
            setEditing(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível guardar", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-16 animate-in fade-in duration-500">
            <div className="text-center">
                {companyData?.logoUrl && <img src={companyData.logoUrl} alt="" className="mx-auto mb-3 h-14 max-w-[180px] object-contain" />}
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Bem-vindo{companyData?.name ? `, ${companyData.name}` : ""}! 🚀</h2>
                <p className="mt-2 text-muted-foreground">Vamos pôr a empresa a funcionar. Dúvidas numa página? Toque no <b className="text-foreground">?</b> lá em cima.</p>
            </div>

            <GettingStartedCard />

            {/* 1. Empresa */}
            <section className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                    <StepBadge icon={Building2} done={profileDone} />
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> Dados da empresa <span className="text-xs font-normal text-muted-foreground">(pode fazer depois)</span></h3>
                        <p className="text-sm text-muted-foreground">NUIT, contactos e logótipo aparecem nas facturas, guias e e-mails.</p>
                    </div>
                    {!editing && canEditCompany && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{profileDone ? "Editar" : "Preencher"}</Button>}
                </div>

                {editing && canEditCompany && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                        <div className="flex items-center gap-4">
                            {details.logoUrl ? (
                                <div className="relative">
                                    <img src={details.logoUrl} alt="Logótipo" className="h-16 max-w-[140px] rounded-lg border bg-white object-contain p-1" />
                                    <button type="button" onClick={() => setDetails((d) => ({ ...d, logoUrl: "" }))} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground" aria-label="Remover logótipo">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex h-16 w-28 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground"><ImagePlus className="h-6 w-6" /></div>
                            )}
                            <Label htmlFor="onb-logo" className="cursor-pointer">
                                <Button type="button" variant="outline" size="sm" asChild>
                                    <span>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{details.logoUrl ? "Alterar logótipo" : "Carregar logótipo"}</span>
                                </Button>
                            </Label>
                            <input id="onb-logo" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="onb-nuit">NUIT <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="onb-nuit" inputMode="numeric" value={details.taxId} onChange={set("taxId")} placeholder="Ex.: 400123456" /></div>
                            <div className="space-y-1.5"><Label htmlFor="onb-phone">Telefone</Label><Input id="onb-phone" inputMode="tel" value={details.phone} onChange={set("phone")} placeholder="Ex.: 84 123 4567" /></div>
                            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="onb-address">Endereço</Label><Input id="onb-address" value={details.address} onChange={set("address")} placeholder="Rua, bairro, cidade" /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                            {profileDone && <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
                            <Button onClick={save} disabled={saving || uploading || !(details.taxId.trim() || details.phone.trim() || details.address.trim() || details.logoUrl)}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Pode mudar tudo isto mais tarde em Definições → Empresa.</p>
                    </div>
                )}
                {!editing && profileDone && (
                    <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{[companyData?.taxId ? `NUIT ${companyData.taxId}` : "", companyData?.phone, companyData?.address].filter(Boolean).join(" · ")}</p>
                )}
            </section>

            {/* 2. Produtos */}
            <section className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                    <StepBadge icon={PackagePlus} done={productsDone} />
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center gap-2 font-semibold"><PackagePlus className="h-4 w-4" /> Já tem uma lista de produtos?</h3>
                        <p className="text-sm text-muted-foreground">Adicione vários de uma vez, em vez de um a um.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Button asChild variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left">
                                <Link href="/inventory/quick"><Zap className="mr-2 h-4 w-4 shrink-0" /><span><b className="block">Stock Rápido</b><span className="text-xs font-normal text-muted-foreground">Regista o produto e a quantidade de uma vez</span></span></Link>
                            </Button>
                            <Button asChild variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left">
                                <Link href="/catalog"><PackagePlus className="mr-2 h-4 w-4 shrink-0" /><span><b className="block">Catálogo / importar Excel</b><span className="text-xs font-normal text-muted-foreground">Cria vários produtos de uma vez</span></span></Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {canEditCompany && (
                <p className="text-center text-sm text-muted-foreground">
                    <Users className="mr-1 inline h-4 w-4" />Tem equipa? <Link href="/users/new" className="font-medium text-primary underline-offset-4 hover:underline">Adicione os funcionários</Link> quando quiser.
                </p>
            )}
        </div>
    );
}
