'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, X, ChevronUp, UserPlus } from 'lucide-react';
import { getGuestRemainingSeconds, exitGuestMode } from '@/lib/guest-mode';

export function GuestBanner() {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => getGuestRemainingSeconds());
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('majorstockx-guest-dismissed') === '1') {
        setIsDismissed(true);
      }
    } catch {
      /* ignore */
    }

    const timer = setInterval(() => {
      const remaining = getGuestRemainingSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('majorstockx-guest-dismissed', '1');
    } catch {
      /* ignore */
    }
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem('majorstockx-guest-dismissed');
    } catch {
      /* ignore */
    }
  };

  const handleExit = () => {
    exitGuestMode();
    window.location.href = '/login';
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (isExpired) {
    return (
      <div role="alert" className="bg-gradient-to-r from-amber-600 to-rose-600 text-white py-2 px-4 text-xs md:text-sm font-medium sticky top-0 z-[60] shadow-md flex flex-wrap justify-center items-center gap-2.5">
        <span>⏱️ <b>Tempo de teste esgotado:</b> Crie a sua conta para guardar o histórico e continuar a utilizar.</span>
        <Link
          href="/register"
          onClick={() => exitGuestMode()}
          className="bg-white text-rose-700 hover:bg-white/90 px-3 py-0.5 rounded-md text-xs font-bold transition-all shadow-sm"
        >
          Criar Conta Definitiva
        </Link>
        <button
          type="button"
          onClick={handleExit}
          className="text-white/80 hover:text-white underline text-xs ml-1"
        >
          Sair
        </button>
      </div>
    );
  }

  // Se minimizado: pílula flutuante compacta e elegante
  if (isDismissed) {
    return (
      <aside aria-label="Modo Convidado" className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2 bg-slate-900/90 text-slate-100 border border-slate-700/80 shadow-xl backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium">
          <Clock className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
          <span className="font-mono text-blue-300 font-semibold">{timeFormatted}</span>
          <span className="text-slate-400 hidden xs:inline">· Convidado</span>
          <button
            type="button"
            onClick={handleRestore}
            title="Expandir aviso do modo convidado"
            className="p-0.5 hover:text-white rounded-full transition-colors ml-0.5"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <Link
            href="/register"
            onClick={() => exitGuestMode()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ml-1 shadow-sm"
          >
            Criar Conta
          </Link>
        </div>
      </aside>
    );
  }

  // Barra superior não invasiva
  return (
    <aside aria-label="Modo Convidado" className="bg-slate-900/95 text-slate-200 border-b border-blue-500/20 py-1.5 px-3 sm:px-4 text-xs font-medium sticky top-0 z-[60] shadow-sm backdrop-blur-sm transition-all duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md font-mono font-semibold shrink-0">
            <Clock className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            {timeFormatted}
          </span>
          <span className="truncate hidden sm:inline text-slate-300 text-xs">
            <strong className="text-white">Modo Convidado:</strong> Empresa activa com 30 produtos, vendas e relatórios dos últimos 30 dias.
          </span>
          <span className="truncate sm:hidden text-slate-300 text-xs">
            Modo Convidado activo
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/register"
            onClick={() => exitGuestMode()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all shadow-sm flex items-center gap-1"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Criar Conta</span>
          </Link>
          <button
            type="button"
            onClick={handleExit}
            className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            title="Sair do teste"
          >
            Sair
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
            title="Fechar aviso (minimizar)"
            aria-label="Fechar alerta do modo convidado"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
