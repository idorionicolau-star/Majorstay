"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BedDouble,
  Package,
  Zap,
  Menu
} from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

interface BottomNavProps {
  onMenuClick: () => void;
}

/** Os separadores da barra de baixo (a ordem é a mesma do swipe entre páginas). */
export function useNavTabs() {
  return [
    { title: "Início", href: "/dashboard", icon: LayoutDashboard, id: "dashboard" },
    { title: "Quartos", href: "/rooms", icon: BedDouble, id: "rooms" },
    { title: "Lounge", href: "/pos", icon: Zap, id: "pos" },
    { title: "Bar", href: "/inventory", icon: Package, id: "inventory", also: ["/catalog"] },
  ];
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const pathname = usePathname();
  // Com o teclado aberto a barra de baixo só ocupa espaço — esconde-se.
  const keyboardOpen = useKeyboardInset() > 0;
  const items = useNavTabs();

  if (keyboardOpen) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 md:hidden pb-safe touch-none select-none">
      <div className="grid h-full grid-flow-col auto-cols-fr">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) || !!item.also?.some((p) => pathname.startsWith(p));
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              data-tour={`nav:${item.href}`}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors relative touch-manipulation",
                isActive
                  ? "text-primary dark:text-primary"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <div className={cn(
                "p-1 rounded-xl transition-all",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
              </div>
              <span className="text-[10px] font-medium leading-none">{item.title}</span>
              {isActive && (
                <span className="absolute top-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
              )}
            </Link>
          );
        })}

        {/* Menu Button */}
        <button
          data-tour="nav-more"
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors touch-manipulation"
        >
          <div className="p-1">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </div>
    </nav>
  );
}
