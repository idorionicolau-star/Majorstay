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
    const { user, logout, firebaseUser } = useContext(InventoryContext) || { user: null, logout: async () => { }, firebaseUser: null };

    const handleLinkClick = () => {
        // Dispatch custom event for loading bar
        window.dispatchEvent(new CustomEvent('navigation-start'));
        onLinkClick();
    };

    const { groups, isActive, simple, hiddenCount, setSimple } = useNavGroups();

    return (
        <aside className="flex flex-col h-full bg-[#FFFDF9] dark:bg-[#1E1714] border-r border-[#E5DFD6] dark:border-[#382D26]">
            <div className="flex h-20 items-center justify-center border-b border-[#E5DFD6]/60 dark:border-[#382D26]/60 px-4">
                <Link href="/dashboard" className="flex items-center justify-center" onClick={handleLinkClick}>
                    <MajorStayLogo size="md" showTagline />
                </Link>
            </div>
            <nav className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
                {groups.map(group => (
                    <div key={group.id} className="flex flex-col gap-1">
                        {group.id !== 'inicio' && (
                            <p className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#8B7E74] dark:text-[#A69B93]">{group.label}</p>
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
                                        "flex items-center gap-4 rounded-xl transition-all font-medium",
                                        item.isSubItem ? "pl-14 pr-4 py-2 text-sm" : "px-4 py-3 text-base",
                                        active
                                            ? "bg-[#F4EDE0] dark:bg-[#2A221E] text-primary shadow-sm font-bold"
                                            : "text-stone-600 dark:text-stone-300 hover:text-primary hover:bg-[#F4EDE0]/60 dark:hover:bg-[#2A221E]/60"
                                    )}
                                >
                                    {!item.isSubItem && <item.icon className={cn("h-6 w-6", active ? "text-primary" : "text-stone-400")} />}
                                    <span className="flex-1">{item.title}</span>
                                    {item.locked && <Lock className="h-4 w-4 text-stone-400" aria-label="Não incluído no seu plano" />}
                                    {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </Link>
                            );
                        })}
                    </div>
                ))}
                <MenuModeToggle simple={simple} hiddenCount={hiddenCount} onChange={setSimple} />
                <SupportNavButton onClick={onLinkClick} />
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-[#E5DFD6] dark:border-[#382D26]">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F4EDE0] dark:hover:bg-[#2A221E] cursor-pointer transition-colors group outline-none">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#BA5A1A] to-[#DF9E42] p-[2px] shrink-0">
                                <div className="rounded-full w-full h-full bg-[#FFFDF9] dark:bg-[#1E1714] p-[1px] overflow-hidden">
                                    {user?.profilePictureUrl ? (
                                        <Image src={user.profilePictureUrl} alt="User" width={40} height={40} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        <div className="w-full h-full bg-[#EFEBE4] dark:bg-[#2A221E] flex items-center justify-center text-xs font-bold text-stone-600 dark:text-stone-300">
                                            {user?.username?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col overflow-hidden text-left">
                                <span className="text-sm font-bold text-stone-800 dark:text-stone-100 truncate group-hover:text-primary transition-colors">
                                    {user?.username || 'Utilizador'}
                                </span>
                                <span className="text-xs text-stone-400 truncate">
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
