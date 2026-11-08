'use client';

import React from 'react';
import { BedDouble, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BRAND } from '@/lib/brand';

export default function RoomsPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BedDouble className="h-7 w-7 text-primary" />
            Quadro de Quartos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {BRAND.tagline}
          </p>
        </div>
      </div>

      {/* Contadores do topo (Livre, Ocupado, Tempo Excedido) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Quartos Livres</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">--</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Ocupados</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">--</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Tempo Excedido</p>
            <p className="text-xl font-bold text-rose-600">--</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Estadias Hoje</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">--</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white/50 dark:bg-slate-900/50">
        <BedDouble className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">Quadro em Preparação</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          O modelo de dados dos quartos e cronómetros de estadia em tempo real será ativado na Fase 3 e 4.
        </p>
      </div>
    </div>
  );
}
