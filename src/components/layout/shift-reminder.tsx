'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { useInventory } from '@/context/inventory-context';
import { sanitizeSchedule, slotAt } from '@/lib/shift-schedule';

const REPEAT_MS = 10 * 60_000; // repete o som a cada 10 minutos enquanto não houver turno
const CHECK_MS = 60_000;

/**
 * Lembrete para o funcionário abrir o turno: aviso no topo (em qualquer página) e uma voz curta ("Inicie o seu turno"),
 * a repetir de 10 em 10 minutos. Não bloqueia nada. Só aparece se ninguém tem a caixa aberta (e a pessoa não fechou um turno há pouco)
 * e não para o gerente/dono. O som só pode tocar depois de o utilizador tocar no ecrã (regra dos navegadores).
 */
export function ShiftReminder() {
  const { companyId, isGuest, isReadOnly, user, companyData } = useInventory();
  const scheduleKey = JSON.stringify(sanitizeSchedule((companyData as { shiftSchedule?: unknown } | null | undefined)?.shiftSchedule));
  const pathname = usePathname();
  const [noShift, setNoShift] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayed = useRef(0);
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';
  const active = !!companyId && !isGuest && !isReadOnly && !isManager;

  const check = useCallback(async () => {
    if (!active) { setNoShift(false); return; }
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/shifts?companyId=${encodeURIComponent(companyId!)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!res.ok) return; // sem permissão para turnos ou sem ligação: não incomoda
      const json = await res.json();
      // quem acabou de fechar o turno (últimas 12 horas) não é lembrado outra vez
      const since = json.lastClosed ? Date.now() - new Date(json.lastClosed.closedAt).getTime() : Infinity;
      // com turnos definidos, só lembra dentro da hora de um turno (fora disso ninguém devia estar a trabalhar)
      const schedule = JSON.parse(scheduleKey);
      const inShiftHours = schedule.length === 0 || !!slotAt(schedule, new Date());
      setNoShift(!json.current && !json.otherOpen && !(since >= 0 && since < 12 * 3600_000) && inShiftHours);
    } catch { /* sem ligação: tenta na próxima vez */ }
  }, [active, companyId, scheduleKey]);

  useEffect(() => {
    check();
    if (!active) return;
    const tick = () => { if (document.visibilityState === 'visible') check(); };
    const id = setInterval(tick, CHECK_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [active, check, pathname]);

  const play = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayed.current < REPEAT_MS) return;
    try {
      if (!audioRef.current) { audioRef.current = new Audio('/sounds/iniciar-turno.mp3'); audioRef.current.preload = 'auto'; }
      void audioRef.current.play().then(() => { lastPlayed.current = Date.now(); }).catch(() => { /* ainda sem toque no ecrã */ });
    } catch { /* sem áudio */ }
  }, []);

  // toca assim que possível (1.º toque) e volta a tocar de 10 em 10 minutos
  useEffect(() => {
    if (!noShift) return;
    play();
    const onTouch = () => play();
    window.addEventListener('pointerdown', onTouch);
    const id = setInterval(play, 30_000);
    return () => { window.removeEventListener('pointerdown', onTouch); clearInterval(id); };
  }, [noShift, play]);

  // em Quartos a barra do turno já mostra isto
  if (!noShift || pathname.startsWith('/rooms')) return null;
  return (
    <Link href="/rooms" role="status" className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white sticky top-0 z-[55] shadow-md">
      <Wallet className="h-4 w-4 shrink-0" /> Ainda não iniciou o turno. Toque aqui para abrir o turno.
    </Link>
  );
}
