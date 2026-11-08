"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwipeViewProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    /**
     * Align items to start or center of the view
     * @default "center"
     */
    snapAlign?: "start" | "center" | "end"
    /**
     * Spacing between items
     * @default "space-x-4"
     */
    gap?: string // Tailwind class for gap
}

export function SwipeView({
    children,
    className,
    snapAlign = "center",
    gap = "space-x-4",
    ...props
}: SwipeViewProps) {
    return (
        <div
            className={cn(
                "flex overflow-x-auto snap-x snap-mandatory pb-4 pt-2 -mx-4 px-4 scroll-smooth no-scrollbar",
                gap,
                className
            )}
            {...props}
        >
            {React.Children.map(children, (child) => (
                <div
                    className={cn(
                        "shrink-0 snap-always",
                        {
                            "snap-start": snapAlign === "start",
                            "snap-center": snapAlign === "center",
                            "snap-end": snapAlign === "end", // standard CSS scroll-snap-align value
                        }
                    )}
                >
                    {child}
                </div>
            ))}
        </div>
    )
}
