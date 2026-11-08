"use client";

import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tutorialFor } from "./guides";
import { startGuide } from "./guide-store";

/**
 * Botão "?" no topo: explica a página aberta, só quando a pessoa pede. (Já não há tutoriais nem convites que
 * aparecem sozinhos — interrompiam quem estava a trabalhar.) Só aparece onde há tutorial.
 */
export function PageHelpButton() {
    const pathname = usePathname();
    const t = tutorialFor(pathname);
    if (!t) return null;
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            data-tour="help-button"
            className="h-9 w-9 md:h-10 md:w-10"
            aria-label={`Como funciona: ${t.title}`}
            title="Como funciona esta página"
            onClick={() => startGuide(t.guide)}
        >
            <HelpCircle className="h-5 w-5" />
        </Button>
    );
}
