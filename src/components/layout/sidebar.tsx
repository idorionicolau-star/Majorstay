
"use client";

import Link from "next/link";
import Image from "next/image";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import { InventoryContext } from "@/context/inventory-context";
import { useNavGroups } from "./use-nav-groups";
import { useNavHint } from "@/hooks/use-nav-hint";
import { HelpCircle, LifeBuoy, Lock, LogOut, Settings, User as UserIcon, ShieldCheck } from "lucide-react";
import { openTour } from "@/components/onboarding/app-tour";
import { MenuModeToggle } from "./menu-mode-toggle";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { openSupport, SupportNavButton } from "@/components/support/support-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
    const { user, logout, firebaseUser } = useContext(InventoryContext) || { user: null, logout: async () => { }, firebaseUser: null };

    const { groups, isActive, simple, hiddenCount, setSimple } = useNavGroups();
    // a recarregar: o nome da última vez, em vez de "Utilizador"
    const hint = useNavHint();
    const name = user?.username || hint?.name;

    return (
        <aside className="hidden md:flex flex-col py-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-50 fixed inset-y-0 left-0 w-64 h-screen transition-all duration-300">
            {/* Logo Area */}
            <div className="h-12 w-full flex items-center px-6 mb-6 cursor-pointer hover:scale-105 transition-transform group">
                <Link href="/dashboard" className="flex items-center gap-3 w-full h-full">
                    <div className="relative w-10 h-10 shrink-0">
                        <Image
                            src="/logo.svg"
                            alt="MajorStockX Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <span className="font-headline font-bold text-xl tracking-tight text-primary">MajorStockX</span>
                </Link>
            </div>

            {/* Navigation — agrupada por tarefa */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-4 overflow-y-auto scrollbar-none">
                {groups.map(group => (
                    <div key={group.id} className="flex flex-col gap-0.5">
                        {group.id !== 'inicio' && (
                            <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
                        )}
                        {group.items.map(item => {
                            const active = isActive(item);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-tour={`nav:${item.href}`}
                                    onClick={() => window.dispatchEvent(new CustomEvent('navigation-start'))}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl transition-all duration-200 group relative",
                                        item.isSubItem ? "pl-11 pr-4 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
                                        active
                                            ? "bg-primary/10 text-primary font-bold shadow-sm"
                                            : "text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    )}
                                >
                                    {!item.isSubItem && (
                                        <item.icon className={cn(
                                            "h-5 w-5 shrink-0 transition-transform duration-200",
                                            active ? "text-primary scale-110" : "group-hover:text-primary group-hover:scale-110"
                                        )} />
                                    )}
                                    <span className="font-medium transition-colors duration-200">{item.title}</span>
                                    {item.locked && <Lock className="ml-auto h-3.5 w-3.5 text-slate-400" aria-label="Não incluído no seu plano" />}
                                </Link>
                            );
                        })}
                    </div>
                ))}
                <MenuModeToggle simple={simple} hiddenCount={hiddenCount} onChange={setSimple} />
                <SupportNavButton />
            </nav>

            {/* Bottom Actions / User */}
            <div className="flex flex-col mt-auto px-4 pt-4 pb-6 w-full">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group outline-none">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] shrink-0">
                                <div className="rounded-full w-full h-full bg-white dark:bg-slate-900 p-[1px] overflow-hidden">
                                    {user?.profilePictureUrl ? (
                                        <Image src={user.profilePictureUrl} alt="User" width={40} height={40} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col overflow-hidden text-left">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors">
                                    {name || 'Utilizador'}
                                </span>
                                <span className="text-xs text-slate-400 truncate">
                                    {firebaseUser?.email || user?.email || hint?.email || ''}
                                </span>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mb-2">
                        <DropdownMenuLabel>A minha conta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <Link href="/settings">
                            <DropdownMenuItem className="cursor-pointer">
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Perfil</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/settings">
                            <DropdownMenuItem className="cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Configurações</span>
                            </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => openTour()}>
                            <HelpCircle className="mr-2 h-4 w-4" />
                            <span>Como a app funciona</span>
                        </DropdownMenuItem>
                        {isSuperAdminEmail(firebaseUser?.email || user?.email) && (
                            <Link href="/admin/subscriptions">
                                <DropdownMenuItem className="cursor-pointer" data-tour="nav-admin">
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    <span>Administração</span>
                                </DropdownMenuItem>
                            </Link>
                        )}
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { openSupport(); }}>
                            <LifeBuoy className="mr-2 h-4 w-4" />
                            <span>Ajuda e suporte</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300" onClick={() => logout()}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
