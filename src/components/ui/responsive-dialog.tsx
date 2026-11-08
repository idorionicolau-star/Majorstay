"use client"

import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"

interface ResponsiveDialogProps {
    children: React.ReactNode
    trigger?: React.ReactNode
    title?: string
    description?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

export function ResponsiveDialog({
    children,
    trigger,
    title,
    description,
    open,
    onOpenChange,
    className,
}: ResponsiveDialogProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
                <DialogContent className={cn("sm:max-w-[425px]", className)}>
                    <DialogHeader>
                        {title && <DialogTitle>{title}</DialogTitle>}
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                    {children}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
            <DrawerContent className={className}>
                <DrawerHeader className="text-left">
                    {title && <DrawerTitle>{title}</DrawerTitle>}
                    {description && <DrawerDescription>{description}</DrawerDescription>}
                </DrawerHeader>
                {/* Um só scroll: o corpo da gaveta (o conteúdo não traz o seu). */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
                    {children}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
