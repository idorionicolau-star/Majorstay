"use client";

import { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval 
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
}

export function UniversalCalendar({ selectedDate, onDateSelect }: DatePickerProps) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { locale: pt }),
    end: endOfWeek(endOfMonth(viewDate), { locale: pt }),
  });

  const handleDateClick = (day: Date) => {
    onDateSelect(day);
  };

  return (
    <div className="w-full bg-background border rounded-xl shadow-lg p-4 select-none">
      {/* Navegação */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-bold text-foreground capitalize">
          {format(viewDate, 'MMMM yyyy', { locale: pt })}
        </h3>
        <div className="flex gap-1">
          <button 
            type="button"
            onClick={() => setViewDate(subMonths(viewDate, 1))} 
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            <ChevronLeft size={18} className="text-muted-foreground" />
          </button>
          <button 
            type="button"
            onClick={() => setViewDate(addMonths(viewDate, 1))} 
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Dias da Semana */}
      <div className="grid grid-cols-7 mb-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Grade de Dias */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDateClick(day)}
              className={cn(`
                h-9 w-9 flex items-center justify-center rounded-lg text-sm transition-all`,
                !isCurrentMonth && 'text-muted-foreground/30 pointer-events-none',
                isCurrentMonth && 'text-foreground hover:bg-accent',
                isSelected && 'bg-primary !text-primary-foreground font-bold shadow-md',
                isToday && !isSelected && 'border border-primary text-primary font-bold'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Botão para Hoje */}
      <button
        type="button"
        onClick={() => {
          const today = new Date();
          setViewDate(today);
          handleDateClick(today);
        }}
        className="w-full mt-4 py-2 text-xs font-semibold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
      >
        Hoje
      </button>
    </div>
  );
}
