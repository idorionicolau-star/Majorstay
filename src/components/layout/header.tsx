
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { UserNav } from "@/components/user-nav";
import { Button } from "@/components/ui/button";
import { Settings, Search, Menu, Moon, Sun } from "lucide-react";
import { mainNavItems } from "@/lib/data";
import { SheetTrigger } from "../ui/sheet";
import { ConnectionStatus } from "../connection-status";
import { useTheme } from "../theme-provider";
import { PageHelpButton } from "@/components/guide/page-help";
import React from "react";
import { BackButton, useNavTracker } from "./back-button";

export function Header({ onSearchClick }: { onSearchClick: () => void }) {
  const pathname = usePathname();
  const { setMode } = useTheme();
  useNavTracker();
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    setMode(isDark ? 'light' : 'dark')
  }

  const getPageTitle = () => {
    // Handle nested routes like /inventory/history by sorting by path length
    // as abas de uma secção (ex.: /catalog em Produtos) usam o título da secção
    const paths = mainNavItems.flatMap(item => [item.href, ...(item.also || [])].map(path => ({ path, title: item.title })));
    const sortedPaths = paths.sort((a, b) => b.path.length - a.path.length);

    if (pathname.startsWith('/settings')) return 'Ajustes';

    const matchingItem = sortedPaths.find(item => pathname.startsWith(item.path));

    if (matchingItem) return matchingItem.title;

    return "Dashboard"; // Fallback
  };

  const pageTitle = getPageTitle();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 dark:bg-slate-950 sm:px-6 border-slate-200/60 dark:border-slate-800/60">

      {/* Theme Toggle for mobile (Left side) */}
      <div className="flex items-center gap-1 md:hidden">
        <BackButton />
        {isMounted ? (
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
            <Sun className="h-[1rem] w-[1rem] rotate-0 scale-100 transition-all ease-overshoot duration-500 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1rem] w-[1rem] rotate-90 scale-0 transition-all ease-overshoot duration-500 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" disabled />
        )}
      </div>

      {/* Hamburger menu -> replaced by Theme Toggle */}
      <div className="hidden">
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </SheetTrigger>
      </div>

      {/* Centered Page Title on mobile */}
      {/* Título no telemóvel: ocupa o espaço entre os botões (com nomes compridos corta com "…" em vez de tapar o "?") */}
      <div className="min-w-0 flex-1 text-center md:hidden">
        <h1 className="truncate text-base font-bold">{pageTitle}</h1>
      </div>

      {/* Search bar for desktop, hidden on mobile */}
      {/* min-w-0: a pesquisa encolhe em vez de empurrar os ícones para fora do ecrã (tablet em pé) */}
      <div className="hidden min-w-0 md:flex flex-1 items-center gap-2">
        <BackButton />
        <Button
          variant="outline"
          className="relative w-full min-w-0 max-w-sm overflow-hidden px-4 py-2 h-11 justify-start items-center text-left font-normal bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-300/70 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:border-slate-700"
          onClick={onSearchClick}
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">Pesquisa Rápida</span>
          <kbd className="pointer-events-none hidden h-6 shrink-0 select-none items-center gap-1 rounded border bg-slate-200 border-slate-300 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:bg-slate-700/80 dark:border-slate-600 dark:text-slate-300 lg:flex">
            Ctrl+K
          </kbd>
        </Button>
      </div>

      {/* Right side icons */}
      <div className="flex shrink-0 items-center gap-1 md:gap-3 lg:gap-4 ml-auto">
        <div className="hidden md:block">
          <ConnectionStatus />
        </div>
        {/* Desktop Theme Toggle (hidden on mobile) */}
        <div className="hidden md:flex">
          {isMounted ? (
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-10 w-10">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all ease-overshoot duration-500 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all ease-overshoot duration-500 dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" disabled />
          )}
        </div>
        {/* Pesquisa Rápida no telemóvel: produtos e perguntas ao assistente */}
        <Button variant="ghost" size="icon" onClick={onSearchClick} className="h-10 w-10 md:hidden" aria-label="Pesquisa rápida">
          <Search className="h-5 w-5" />
        </Button>
        <PageHelpButton />
        <NotificationsDropdown />
        <UserNav />
      </div>
    </header>
  );
}
