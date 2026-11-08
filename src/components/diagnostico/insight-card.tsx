
"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface InsightCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
  alertType?: 'critical' | 'warning' | 'success' | 'info';
}

export function InsightCard({ title, icon: Icon, children, className, fullHeight, alertType }: InsightCardProps) {

  const iconColorClasses = {
    critical: "text-rose-500",
    warning: "text-amber-500",
    success: "text-emerald-500",
    info: "text-cyan-500"
  }

  return (
    <Card className={cn(
      'bg-card border-border shadow-sm rounded-2xl',
      fullHeight && 'h-full flex flex-col',
      className
    )}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 font-headline">
          <Icon className={cn("h-5 w-5 text-slate-500 dark:text-slate-400", alertType && iconColorClasses[alertType])} />
          <span className='text-slate-800 dark:text-slate-200'>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(fullHeight && 'flex-grow')}>
        {children}
      </CardContent>
    </Card>
  );
}
