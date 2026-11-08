import { Skeleton } from "@/components/ui/skeleton"

export function PanelSkeleton() {
    return (
        <div className="w-full h-[400px] rounded-xl bg-slate-50/50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2 flex-grow">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </div>
    )
}
