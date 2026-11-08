"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { hideKeyboard, isTouchDevice, keyboardIsOpenFor, keyboardWasOpenOnPress } from "@/lib/keyboard"
import { useKeyboardInset } from "@/hooks/use-keyboard-inset"

// repositionInputs desligado: o Vaul ajustava a altura da gaveta à mão quando o teclado abria e, nos browsers em que
// a página encolhe com o teclado (Huawei, Samsung, WebViews), não a repunha ao fechá-lo — a gaveta ficava pequena e
// cortada a meio. Agora a altura vem do estado do teclado (DrawerContent), por isso volta sozinha ao normal.
const Drawer = ({
    shouldScaleBackground = false,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
    <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        repositionInputs={false}
        {...props}
    />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Overlay
        ref={ref}
        className={cn("fixed inset-0 z-50 bg-black/80", className)}
        {...props}
    />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, onPointerDownOutside, style, ...props }, ref) => {
    // Teclado aberto (Chrome/Safari: só a parte visível encolhe): a gaveta sobe para ficar por cima do teclado e
    // nunca é mais alta do que o que se vê. Sem teclado, não há estilo nenhum — nada fica "preso".
    const keyboard = useKeyboardInset();
    // Prevent drawer from closing when focus moves outside (e.g., toast notifications
    // appearing or disappearing cause focus shifts that are misinterpreted as dismissal).
    const preventFocusOutside = React.useCallback((e: Event) => {
        e.preventDefault();
    }, []);

    // Com o teclado aberto, o primeiro toque fora só fecha o teclado (como nas apps nativas): sem isto, tocar
    // ao lado para "esconder o teclado" fechava a janela e perdia-se o que estava escrito.
    const keyboardFirst = React.useCallback((e: Event) => {
      if (isTouchDevice() && (keyboardIsOpenFor() || keyboardWasOpenOnPress())) {
        e.preventDefault();
        hideKeyboard();
      }
    }, []);

    const preventInteractOutside = React.useCallback((e: Event) => {
        const target = e.target as HTMLElement;
        // Don't close if clicking on a toast notification
        if (target.closest('[data-sonner-toast]') || target.closest('[id^="radix-"]')) {
            e.preventDefault();
        }
    }, []);

    return (
        <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive.Content
                ref={ref}
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[96dvh] flex-col rounded-t-[10px] border bg-background",
                    className
                )}
                style={keyboard ? { ...style, bottom: keyboard, maxHeight: `min(96dvh, calc(100dvh - ${keyboard}px - 16px))` } : style}
                onFocusOutside={preventFocusOutside}
                onPointerDownOutside={(e) => { onPointerDownOutside?.(e); if (!e.defaultPrevented) keyboardFirst(e) }}
                onInteractOutside={preventInteractOutside}
                {...props}
            >
                <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    )
})
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
        {...props}
    />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn("mt-auto flex flex-col gap-2 p-4", className)}
        {...props}
    />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Title
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
    React.ElementRef<typeof DrawerPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DrawerPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
    Drawer,
    DrawerPortal,
    DrawerOverlay,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
}
