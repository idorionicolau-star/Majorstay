"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BedDouble,
  Package,
  Wine,
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
    { title: "Lounge & Bar", href: "/pos", icon: Wine, id: "pos" },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#FFFDF9] dark:bg-[#1E1714] border-t border-[#E5DFD6] dark:border-[#382D26] md:hidden pb-safe touch-none select-none">
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
                  ? "text-primary dark:text-primary font-bold"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
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
                <span className="absolute top-0 inset-x-0 h-0.5 bg-primary" />
              )}
            </Link>
          );
        })}

        {/* Menu Button */}
        <button
          data-tour="nav-more"
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors touch-manipulation"
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
