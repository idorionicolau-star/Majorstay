import { Skeleton } from "@/components/ui/skeleton"

export function ChartSkeleton() {
    return (
        <div className="w-full h-[400px] rounded-xl bg-slate-50/50 dark:bg-slate-900/50 p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="flex items-end gap-2 h-[300px]">
                {[...Array(12)].map((_, i) => (
                    <Skeleton
                        key={i}
                        className="w-full rounded-t-lg"
                        style={{
                            height: `${Math.random() * 80 + 20}%`
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
