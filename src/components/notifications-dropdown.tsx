"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { arrayUnion, collection, doc, limit, onSnapshot, orderBy, query, updateDoc, writeBatch, type Timestamp } from "firebase/firestore";
import { formatDistanceToNowStrict } from "date-fns";
import { pt } from "date-fns/locale";
import { AlertTriangle, Bell, BellOff, BellRing, CircleDollarSign, ClipboardList, Hammer, Info, Package, ShieldAlert, ShoppingCart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore } from "@/firebase/provider";
import { usePushNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

type FeedItem = {
    id: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
    audience?: "all" | "managers";
    actorId?: string;
    actorName?: string;
    createdAt?: Timestamp | null;
    readBy?: string[];
};

const TYPE: Record<string, { icon: React.ElementType; bg: string }> = {
    sale: { icon: ShoppingCart, bg: "bg-emerald-500" },
    stock: { icon: AlertTriangle, bg: "bg-red-500" },
    price: { icon: CircleDollarSign, bg: "bg-amber-500" },
    production: { icon: Hammer, bg: "bg-indigo-500" },
    order: { icon: ClipboardList, bg: "bg-sky-500" },
    inventory: { icon: Package, bg: "bg-violet-500" },
    security: { icon: ShieldAlert, bg: "bg-rose-600" },
    info: { icon: Info, bg: "bg-slate-500" },
};

const initials = (name?: string) => (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function useFeed() {
    const firestore = useFirestore();
    const ctx = useContext(InventoryContext);
    const companyId = ctx?.companyId;
    const user = ctx?.user;
    const isGuest = !!ctx?.isGuest;
    const isManager = !!user && (user.role === "Admin" || user.role === "Dono");
    const [items, setItems] = useState<FeedItem[]>([]);

    useEffect(() => {
        if (!companyId || !user || isGuest) return; // o convidado não tem feed no servidor
        const q = query(collection(firestore, `companies/${companyId}/notifications`), orderBy("createdAt", "desc"), limit(60));
        return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedItem, "id">) }))), (e) => console.warn("[feed]", e));
    }, [firestore, companyId, user, isGuest]);

    const visible = useMemo(
        () => items.filter((n) => (n.actorId !== user?.id || n.type === "stock") && (n.audience !== "managers" || isManager)),
        [items, user?.id, isManager]
    );
    const isUnread = (n: FeedItem) => !!user && !(n.readBy || []).includes(user.id);
    const unread = visible.filter(isUnread);

    const markRead = (n: FeedItem) => {
        if (!companyId || !user || !isUnread(n)) return;
        updateDoc(doc(firestore, `companies/${companyId}/notifications/${n.id}`), { readBy: arrayUnion(user.id) }).catch(() => {});
    };
    const markAll = async () => {
        if (!companyId || !user || !unread.length) return;
        const b = writeBatch(firestore);
        unread.slice(0, 450).forEach((n) => b.update(doc(firestore, `companies/${companyId}/notifications/${n.id}`), { readBy: arrayUnion(user.id) }));
        await b.commit().catch(() => {});
    };
    return { visible, unread, isUnread, markRead, markAll, companyId, user };
}

export function NotificationsDropdown() {
    const router = useRouter();
    const { visible, unread, isUnread, markRead, markAll, companyId, user } = useFeed();
    const { status, enable, busy } = usePushNotifications(companyId, user);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"all" | "unread">("all");
    const list = tab === "unread" ? unread : visible;

    // Unread count on the app icon (Android/desktop PWA), like Facebook
    useEffect(() => {
        const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (!nav.setAppBadge) return;
        (unread.length ? nav.setAppBadge(unread.length) : nav.clearAppBadge?.())?.catch(() => {});
    }, [unread.length]);

    const openItem = (n: FeedItem) => {
        markRead(n);
        setOpen(false);
        if (n.link) router.push(n.link);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações${unread.length ? ` (${unread.length} por ler)` : ""}`}>
                    <Bell className="h-5 w-5" />
                    {unread.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-background">
                            {unread.length > 99 ? "99+" : unread.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-1rem)] max-w-[380px] overflow-hidden rounded-2xl p-0">
                <div className="flex items-center justify-between px-4 pb-2 pt-4">
                    <h3 className="text-xl font-bold">Notificações</h3>
                    {unread.length > 0 && (
                        <button type="button" onClick={markAll} className="text-sm font-medium text-primary hover:underline">Marcar todas como lidas</button>
                    )}
                </div>
                <div className="flex gap-2 px-4 pb-2">
                    {(["all", "unread"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                            className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted")}>
                            {t === "all" ? "Todas" : `Não lidas${unread.length ? ` (${unread.length})` : ""}`}
                        </button>
                    ))}
                </div>

                {status === "default" && (
                    <button type="button" onClick={enable} disabled={busy} className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl bg-primary/10 p-2.5 text-left text-sm">
                        <BellRing className="h-4 w-4 shrink-0 text-primary" /> <span className="flex-1">Receber estes alertas no telemóvel, mesmo com a app fechada</span><b className="text-primary">Activar</b>
                    </button>
                )}
                {status === "denied" && (
                    <Link href="/settings" onClick={() => setOpen(false)} className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-sm">
                        <BellOff className="h-4 w-4 shrink-0 text-amber-600" /> <span className="flex-1">Alertas no telemóvel <b>bloqueados</b> neste aparelho — ver como desbloquear</span>
                    </Link>
                )}

                <div className="max-h-[70vh] overflow-y-auto pb-2">
                    {list.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                            {tab === "unread" ? "Está tudo lido." : "Ainda sem notificações. Vendas, stock crítico e preços a confirmar aparecem aqui."}
                        </div>
                    ) : (
                        list.map((n) => {
                            const t = TYPE[n.type] || TYPE.info;
                            const Icon = t.icon;
                            const unreadItem = isUnread(n);
                            const when = n.createdAt?.toDate ? formatDistanceToNowStrict(n.createdAt.toDate(), { addSuffix: true, locale: pt }) : "agora";
                            return (
                                <button key={n.id} type="button" onClick={() => openItem(n)}
                                    className={cn("mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl p-2 text-left hover:bg-muted", unreadItem && "bg-primary/5")}>
                                    <div className="relative shrink-0">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{initials(n.actorName)}</div>
                                        <span className={cn("absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white ring-2 ring-popover", t.bg)}>
                                            <Icon className="h-3.5 w-3.5" />
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={cn("text-sm leading-snug", unreadItem ? "font-semibold" : "text-muted-foreground")}>
                                            {n.actorName && <b className="text-foreground">{n.actorName}: </b>}{n.title}
                                        </p>
                                        {n.body && <p className="line-clamp-2 text-[13px] text-muted-foreground">{n.body}</p>}
                                        <p className={cn("mt-0.5 text-xs", unreadItem ? "font-semibold text-primary" : "text-muted-foreground")}>{when}</p>
                                    </div>
                                    {unreadItem && <span className="h-3 w-3 shrink-0 rounded-full bg-primary" aria-label="por ler" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
