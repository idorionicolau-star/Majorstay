
"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StockHealthScoreProps {
  score: number;
  label?: string;
}

export function StockHealthScore({ score, label = "SAÚDE DO STOCK" }: StockHealthScoreProps) {
  const chartData = [{ name: "score", value: score }];
  const tone = score >= 75 ? "good" : score >= 45 ? "mid" : "bad";
  const color = tone === "good" ? "hsl(var(--chart-2))" : tone === "mid" ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
                data={chartData}
                startAngle={90}
                endAngle={-270}
                innerRadius="75%"
                outerRadius="100%"
                barSize={12}
            >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                    background
                    dataKey="value"
                    cornerRadius={6}
                    fill={color}
                    className="[&_.recharts-radial-bar-background-sector]:fill-slate-200 dark:[&_.recharts-radial-bar-background-sector]:fill-slate-800"
                />
            </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className={cn(
              "text-4xl font-mono font-bold",
              tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "mid" ? "text-amber-500" : "text-red-500"
              )}>
                {score}
                <span className="text-lg font-sans text-slate-500 dark:text-slate-400">%</span>
            </p>
             <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider text-center px-2">{label}</p>
        </div>
    </div>
  );
}
