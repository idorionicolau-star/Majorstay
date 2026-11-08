import { Skeleton } from "@/components/ui/skeleton"

export function KPISkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 p-6 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-3 w-16" />
                </div>
            ))}
        </div>
    )
}
