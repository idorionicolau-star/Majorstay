"use client"

import { useContext } from "react"
import { LogOut, User as UserIcon, Settings, HelpCircle, ShieldCheck } from "lucide-react"
import { isSuperAdminEmail } from "@/lib/super-admin"
import { openTour } from "@/components/onboarding/app-tour"
import Link from "next/link";

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { InventoryContext } from "@/context/inventory-context"
import { initialsOf } from "@/lib/nav-hint";

export function UserNav() {
  const { user, logout, loading, profilePicture, firebaseUser } = useContext(InventoryContext) || { user: null, logout: () => {}, loading: true, profilePicture: null, firebaseUser: null };

  if (!user) {
    // A arrancar: com sessão guardada o círculo já mostra as iniciais (ou a foto), postas antes da primeira pintura
    // pelo RELOAD_GATE (lib/nav-hint.ts); sem ela fica a pulsar como antes. O CSS está em globals.css (.msx-avatar-hint).
    return loading ? <div className="msx-avatar-hint animate-pulse flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold" aria-hidden /> : null;
  }

  const getInitials = (name?: string) => initialsOf(name) || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
             {profilePicture ? <AvatarImage src={profilePicture} alt={user.username} /> : null}
             <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {getInitials(user.username)}
             </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.role}
            </p>
            <p className="truncate text-xs leading-none text-muted-foreground">{firebaseUser?.email || user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openTour()}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Como a app funciona</span>
        </DropdownMenuItem>
        {isSuperAdminEmail(firebaseUser?.email || user.email) && (
          <DropdownMenuItem asChild data-tour="nav-admin-top">
            <Link href="/admin/subscriptions">
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Administração</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
