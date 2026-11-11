'use client';

import { BRAND } from '@/lib/brand';
import Link from "next/link";
import Image from "next/image";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import { InventoryContext } from "@/context/inventory-context";
import { useNavGroups } from "./use-nav-groups";
import { HelpCircle, LifeBuoy, Lock, LogOut, Settings, User as UserIcon, ShieldCheck } from "lucide-react";
import { openTour } from "@/components/onboarding/app-tour";
import { MenuModeToggle } from "./menu-mode-toggle";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { openSupport, SupportNavButton } from "@/components/support/support-dialog";
import { MajorStayLogo } from "@/components/brand-logo";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileNavProps {
    onLinkClick: () => void;
}

export function MobileNav({ onLinkClick }: MobileNavProps) {
    const { user, logout, firebaseUser, companyData } = useContext(InventoryContext) || { user: null, logout: async () => { }, firebaseUser: null, companyData: null };

    const handleLinkClick = () => {
        // Dispatch custom event for loading bar
        window.dispatchEvent(new CustomEvent('navigation-start'));
        onLinkClick();
    };

    const { groups, isActive, simple, hiddenCount, setSimple } = useNavGroups();

    return (
        <aside className="flex flex-col h-full bg-white dark:bg-[#191E25] border-r border-slate-200/80 dark:border-slate-800">
            <div className="flex h-20 items-center justify-center border-b border-slate-200/80 dark:border-slate-800 px-4">
                <Link href="/dashboard" className="flex items-center justify-center" onClick={handleLinkClick}>
                    <MajorStayLogo size="md" showTagline customLogoUrl={companyData?.logoUrl} customName={companyData?.name} />
                </Link>
            </div>
            <nav className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
                {groups.map(group => (
                    <div key={group.id} className="flex flex-col gap-1">
                        {group.id !== 'inicio' && (
                            <p className="px-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.label}</p>
                        )}
                        {group.items.map(item => {
                            const active = isActive(item);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-tour={`nav:${item.href}`}
                                    onClick={handleLinkClick}
                                    className={cn(
                                        "flex items-center gap-3.5 rounded-2xl transition-all",
                                        item.isSubItem ? "pl-14 pr-4 py-2 text-sm" : "px-3.5 py-2.5 text-sm",
                                        active
                                            ? "bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-950/50 dark:to-indigo-950/30 text-[#006194] dark:text-sky-300 font-extrabold border border-blue-100/80 dark:border-blue-900/40 shadow-xs"
                                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-semibold"
                                    )}
                                >
                                    {!item.isSubItem && (
                                        <div className={cn(
                                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
                                            active
                                                ? "bg-[#007bb9] text-white shadow-sm"
                                                : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"
                                        )}>
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                    )}
                                    <span className="flex-1">{item.title}</span>
                                    {item.locked && <Lock className="h-4 w-4 text-slate-400" aria-label="Não incluído no seu plano" />}
                                </Link>
                            );
                        })}
                    </div>
                ))}
                <MenuModeToggle simple={simple} hiddenCount={hiddenCount} onChange={setSimple} />
                <SupportNavButton onClick={onLinkClick} />
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-slate-200/80 dark:border-slate-800">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 cursor-pointer transition-all group outline-none shadow-xs">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#007bb9] via-sky-400 to-amber-400 p-[2px] shrink-0 shadow-xs">
                                <div className="rounded-full w-full h-full bg-white dark:bg-[#191E25] p-[1px] overflow-hidden">
                                    {user?.profilePictureUrl ? (
                                        <Image src={user.profilePictureUrl} alt="User" width={36} height={36} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <div className="w-full h-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-xs font-black text-[#007bb9] dark:text-sky-300">
                                            {user?.username?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col overflow-hidden text-left min-w-0">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-[#007bb9] transition-colors">
                                    {user?.username || 'Utilizador'}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate font-medium">
                                    {firebaseUser?.email || user?.email || ''}
                                </span>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mb-2">
                        <DropdownMenuLabel>A minha conta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <Link href="/settings" onClick={onLinkClick}>
                            <DropdownMenuItem className="cursor-pointer">
                                <UserIcon className="mr-2 h-4 w-4" />
                                <span>Perfil</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/settings" onClick={onLinkClick}>
                            <DropdownMenuItem className="cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Configurações</span>
                            </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { openTour(); onLinkClick(); }}>
                            <HelpCircle className="mr-2 h-4 w-4" />
                            <span>Como a app funciona</span>
                        </DropdownMenuItem>
                        {isSuperAdminEmail(firebaseUser?.email || user?.email) && (
                            <Link href="/admin/subscriptions" onClick={onLinkClick}>
                                <DropdownMenuItem className="cursor-pointer" data-tour="nav-admin">
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    <span>Administração</span>
                                </DropdownMenuItem>
                            </Link>
                        )}
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { onLinkClick(); openSupport(); }}>
                            <LifeBuoy className="mr-2 h-4 w-4" />
                            <span>Ajuda e suporte</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300" onClick={() => { logout(); onLinkClick(); }}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
