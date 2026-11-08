
"use client";

import { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay,
  eachDayOfInterval 
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CustomCalendarProps {
  events?: Order[];
}

const statusConfig: Record<string, string> = {
    'Pendente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    'Em produção': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    'Concluída': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'Entregue': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};


export function CustomCalendar({ events = [] }: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [direction, setDirection] = useState(0);

  const nextMonth = () => {
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  const prevMonth = () => {
    setDirection(-1);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { locale: pt }),
    end: endOfWeek(endOfMonth(currentMonth), { locale: pt }),
  });

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };
  

  return (
    <div className="bg-background rounded-xl p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: pt })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-full">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>
      
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentMonth.toString()}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden"
          >
            {days.map((day, idx) => {
              const dayEvents = events.filter(e => e.deliveryDate && isSameDay(new Date(e.deliveryDate), day));
              
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "min-h-[100px] bg-background p-2 flex flex-col", 
                    !isSameMonth(day, currentMonth) && 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  <span className={cn(
                      "text-sm font-medium",
                      isSameDay(day, new Date()) && "text-primary font-bold"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  
                  <div className="mt-1 space-y-1 overflow-y-auto">
                    {dayEvents.slice(0, 2).map((event, i) => (
                      <div key={i} className={cn(
                          "text-[10px] p-1 rounded truncate font-bold", 
                          statusConfig[event.status] || 'bg-gray-100 text-gray-700'
                        )}>
                        {event.productName}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground font-bold pt-1">
                            + {dayEvents.length - 2} mais
                        </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
