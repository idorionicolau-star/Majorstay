'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import type { Room, Stay, StayExtension, RoomStatus, StayConsumptionItem, Booking, BookingStatus } from '@/lib/types';
import {
  isGuestCompany,
  getGuestRooms,
  addGuestRoom,
  updateGuestRoom,
  deleteGuestRoom,
  getGuestStays,
  addGuestStay,
  updateGuestStay,
  checkoutGuestStay,
  GUEST_DATA_EVENT,
  getGuestBookings,
  addGuestBooking,
  updateGuestBooking,
} from '@/lib/guest-mode';
import { useInventory } from '@/context/inventory-context';
import { db } from '@/firebase/index';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { authedFetch } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { calculateExpectedCheckOut, computeStayRealtimeStatus } from '@/lib/hospitality-calc';
import { formatCurrency } from '@/lib/utils';

export interface RoomStats {
  total: number;
  free: number;
  occupied: number;
  overtime: number;
  cleaning: number;
  maintenance: number;
  staysTodayCount: number;
  revenueToday: number;
}

interface RoomsContextType {
  rooms: Room[];
  stays: Stay[];
  openStays: Stay[];
  loading: boolean;
  stats: RoomStats;
  addRoom: (roomData: Omit<Room, 'id' | 'createdAt' | 'status'>) => Promise<string>;
  updateRoom: (id: string, data: Partial<Room>) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  checkInStay: (data: {
    roomId: string;
    roomName?: string;
    clientName?: string;
    clientPhone?: string;
    clientDoc?: string;
    contractedHours: number;
    ratePerHour: number;
    paymentMethod?: string;
    notes?: string;
  }) => Promise<string>;
  extendStay: (stayId: string, hours: number, notes?: string) => Promise<void>;
  checkOutStay: (
    stayId: string,
    options?: {
      amountPaid?: number;
      paymentMethod?: string;
      roomNextStatus?: 'cleaning' | 'free';
      notes?: string;
    }
  ) => Promise<any>;
  markRoomCleaned: (roomId: string) => Promise<void>;
  refreshRealtimeStatuses: () => void;
  addStayConsumption: (
    stayId: string,
    item: {
      productId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }
  ) => Promise<void>;
  addStayConsumptionsBulk: (
    stayId: string,
    items: {
      productId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }[]
  ) => Promise<void>;
  removeStayConsumption: (stayId: string, consumptionId: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBookingStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
}

const RoomsContext = createContext<RoomsContextType | undefined>(undefined);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const { companyId, user, canView } = useInventory();
  const canRooms = !!user && canView('rooms');

  const [rawRooms, setRawRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const isGuest = isGuestCompany(companyId);

  // Escuta das coleções de Quartos e Estadias
  useEffect(() => {
    if (isGuest) {
      const loadGuestData = () => {
        setRawRooms(getGuestRooms());
        setStays(getGuestStays());
        setBookings(getGuestBookings());
      };
      loadGuestData();
      setLoading(false);
      window.addEventListener(GUEST_DATA_EVENT, loadGuestData);
      return () => window.removeEventListener(GUEST_DATA_EVENT, loadGuestData);
    }

    if (!companyId || !canRooms) {
      setRawRooms([]);
      setStays([]);
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const roomsRef = collection(db, `companies/${companyId}/rooms`);
    const roomsQuery = query(roomsRef, orderBy('name', 'asc'));

    const unsubRooms = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Room[];
        setRawRooms(list);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar quartos:', error);
        setLoading(false);
      }
    );

    const staysRef = collection(db, `companies/${companyId}/stays`);
    const staysQuery = query(staysRef, orderBy('checkInAt', 'desc'));

    const unsubStays = onSnapshot(
      staysQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Stay[];
        setStays(list);
      },
      (error) => {
        console.error('Erro ao carregar estadias:', error);
      }
    );

    const bookingsRef = collection(db, `companies/${companyId}/bookings`);
    const bookingsQuery = query(bookingsRef, orderBy('checkInDate', 'asc'));

    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Booking[];
        setBookings(list);
      },
      (error) => {
        console.error('Erro ao carregar reservas:', error);
      }
    );

    return () => {
      unsubRooms();
      unsubStays();
      unsubBookings();
    };
  }, [companyId, canRooms, isGuest]);

  // Temporizador de 30 segundos para atualizar em tempo real o tempo restante e detetar excedidos
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshRealtimeStatuses = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Mapeamento dinâmico de status dos quartos (excedido vs ocupado)
  const openStays = useMemo(() => stays.filter((s) => s.status === 'open'), [stays]);

  const rooms = useMemo(() => {
    const now = new Date();
    return rawRooms.map((room) => {
      const activeStay = openStays.find((s) => s.roomId === room.id);
      if (!activeStay) {
        return room;
      }
      const realtime = computeStayRealtimeStatus({
        status: activeStay.status,
        checkInAt: activeStay.checkInAt,
        contractedHours: activeStay.contractedHours,
        extensions: activeStay.extensions,
        now,
      });

      if (realtime.isOvertime && room.status === 'occupied') {
        return { ...room, status: 'overtime' as RoomStatus };
      }
      return room;
    });
  }, [rawRooms, openStays]);

  // Estatísticas do painel
  const stats = useMemo<RoomStats>(() => {
    let free = 0;
    let occupied = 0;
    let overtime = 0;
    let cleaning = 0;
    let maintenance = 0;

    rooms.forEach((r) => {
      if (!r.active) return;
      if (r.status === 'free') free++;
      else if (r.status === 'occupied') occupied++;
      else if (r.status === 'overtime') overtime++;
      else if (r.status === 'cleaning') cleaning++;
      else if (r.status === 'maintenance') maintenance++;
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const staysToday = stays.filter((s) => {
      const dateStr = s.checkInAt
        ? (typeof s.checkInAt === 'string' ? s.checkInAt : s.checkInAt.toDate?.()?.toISOString())?.slice(0, 10)
        : '';
      return dateStr === todayStr;
    });

    const revenueToday = staysToday.reduce((sum, s) => sum + (Number(s.totalAmountPaid) || 0), 0);

    return {
      total: rooms.filter((r) => r.active).length,
      free,
      occupied,
      overtime,
      cleaning,
      maintenance,
      staysTodayCount: staysToday.length,
      revenueToday,
    };
  }, [rooms, stays]);

  // 1. Criar Quarto
  const addRoom = async (roomData: Omit<Room, 'id' | 'createdAt' | 'status'>): Promise<string> => {
    if (isGuest) {
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        ...roomData,
        status: 'free',
        active: true,
        createdAt: new Date().toISOString(),
      };
      addGuestRoom(newRoom);
      toast({ title: 'Quarto criado com sucesso!', description: roomData.name });
      return newRoom.id;
    }

    if (!companyId) throw new Error('Empresa não selecionada.');
    const roomsRef = collection(db, `companies/${companyId}/rooms`);
    const docRef = await addDoc(roomsRef, {
      ...roomData,
      status: 'free',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    toast({ title: 'Quarto adicionado', description: roomData.name });
    return docRef.id;
  };

  // 2. Atualizar Quarto
  const updateRoom = async (id: string, data: Partial<Room>): Promise<void> => {
    if (isGuest) {
      updateGuestRoom(id, data);
      toast({ title: 'Quarto atualizado' });
      return;
    }
    if (!companyId) return;
    const roomDoc = doc(db, `companies/${companyId}/rooms/${id}`);
    await updateDoc(roomDoc, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    toast({ title: 'Quarto atualizado' });
  };

  // 3. Eliminar Quarto
  const deleteRoom = async (id: string): Promise<void> => {
    if (isGuest) {
      deleteGuestRoom(id);
      toast({ title: 'Quarto removido' });
      return;
    }
    if (!companyId) return;
    const roomDoc = doc(db, `companies/${companyId}/rooms/${id}`);
    await deleteDoc(roomDoc);
    toast({ title: 'Quarto eliminado' });
  };

  // 4. Check-in de Estadia
  const checkInStay = async (data: {
    roomId: string;
    roomName?: string;
    clientName?: string;
    clientPhone?: string;
    clientDoc?: string;
    contractedHours: number;
    ratePerHour: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<string> => {
    const contracted = Math.max(1, data.contractedHours || 1);
    const totalDue = contracted * data.ratePerHour;
    const targetRoom = rooms.find((r) => r.id === data.roomId);
    const roomName = data.roomName || targetRoom?.name || 'Quarto';

    if (isGuest) {
      const stayId = `stay-${Date.now()}`;
      const now = new Date();
      const expectedOut = new Date(now.getTime() + contracted * 3600 * 1000);
      const newStay: Stay = {
        id: stayId,
        roomId: data.roomId,
        roomName,
        clientName: data.clientName || 'Hóspede Particular',
        clientPhone: data.clientPhone || '',
        clientDoc: data.clientDoc || '',
        checkInAt: now.toISOString(),
        expectedCheckOutAt: expectedOut.toISOString(),
        contractedHours: contracted,
        extensions: [],
        ratePerHourApplied: data.ratePerHour,
        totalAmountDue: totalDue,
        totalAmountPaid: totalDue,
        paymentMethod: data.paymentMethod || 'Dinheiro',
        openedBy: user?.id || 'guest-user',
        openedByName: user?.username || 'Recepção',
        status: 'open',
        notes: data.notes || '',
        createdAt: now.toISOString(),
      };
      addGuestStay(newStay);
      toast({
        title: 'Check-in efetuado com sucesso!',
        description: `${roomName} — ${contracted}h contratadas`,
      });
      return stayId;
    }

    if (!companyId || !user) throw new Error('Sessão ou empresa indisponível.');

    const stayRef = doc(collection(db, `companies/${companyId}/stays`));
    const now = new Date();
    const expectedOut = new Date(now.getTime() + contracted * 3600 * 1000);

    const batch = writeBatch(db);

    batch.set(stayRef, {
      roomId: data.roomId,
      roomName,
      clientName: data.clientName || 'Hóspede Particular',
      clientPhone: data.clientPhone || '',
      clientDoc: data.clientDoc || '',
      checkInAt: serverTimestamp(),
      expectedCheckOutAt: expectedOut.toISOString(),
      contractedHours: contracted,
      extensions: [],
      ratePerHourApplied: data.ratePerHour,
      totalAmountDue: totalDue,
      totalAmountPaid: totalDue,
      paymentMethod: data.paymentMethod || 'Dinheiro',
      openedBy: user.id,
      openedByName: user.username,
      status: 'open',
      notes: data.notes || '',
      createdAt: serverTimestamp(),
    });

    const roomRef = doc(db, `companies/${companyId}/rooms/${data.roomId}`);
    batch.update(roomRef, {
      status: 'occupied',
      currentStayId: stayRef.id,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    toast({
      title: 'Check-in efetuado com sucesso!',
      description: `${roomName} — ${contracted}h contratadas`,
    });

    return stayRef.id;
  };

  // 5. Prorrogar Estadia (Adicionar Horas Extras)
  const extendStay = async (stayId: string, hours: number, notes?: string): Promise<void> => {
    const extHours = Math.max(1, hours || 1);
    const currentStay = stays.find((s) => s.id === stayId);
    if (!currentStay) throw new Error('Estadia não encontrada.');

    if (isGuest) {
      const ext: StayExtension = {
        hours: extHours,
        addedAt: new Date().toISOString(),
        addedBy: user?.id || 'guest',
        addedByName: user?.username || 'Recepção',
        notes,
      };
      const updatedExtensions = [...(currentStay.extensions || []), ext];
      const newExpected = calculateExpectedCheckOut(currentStay.checkInAt, currentStay.contractedHours, updatedExtensions);
      const totalContractedHours = currentStay.contractedHours + updatedExtensions.reduce((s, e) => s + e.hours, 0);
      const newTotalDue = totalContractedHours * currentStay.ratePerHourApplied;

      updateGuestStay(stayId, {
        extensions: updatedExtensions,
        expectedCheckOutAt: newExpected.toISOString(),
        totalAmountDue: newTotalDue,
      });

      toast({
        title: 'Estadia prorrogada',
        description: `+${extHours}h adicionadas ao ${currentStay.roomName}`,
      });
      return;
    }

    if (!companyId || !user) throw new Error('Sessão indisponível.');

    const stayRef = doc(db, `companies/${companyId}/stays/${stayId}`);
    const staySnap = await getDoc(stayRef);
    if (!staySnap.exists()) throw new Error('Estadia não encontrada no servidor.');
    const stayData = staySnap.data() as Stay;

    const ext: StayExtension = {
      hours: extHours,
      addedAt: new Date().toISOString(),
      addedBy: user.id,
      addedByName: user.username,
      notes,
    };

    const updatedExtensions = [...(stayData.extensions || []), ext];
    const newExpected = calculateExpectedCheckOut(stayData.checkInAt, stayData.contractedHours, updatedExtensions);
    const totalContractedHours = stayData.contractedHours + updatedExtensions.reduce((s, e) => s + e.hours, 0);
    const newTotalDue = totalContractedHours * stayData.ratePerHourApplied;

    await updateDoc(stayRef, {
      extensions: updatedExtensions,
      expectedCheckOutAt: newExpected.toISOString(),
      totalAmountDue: newTotalDue,
    });

    toast({
      title: 'Estadia prorrogada',
      description: `+${extHours}h adicionadas ao ${stayData.roomName}`,
    });
  };

  // 6. Check-out de Estadia (com validação anti-roubo no servidor)
  const checkOutStay = async (
    stayId: string,
    options?: {
      amountPaid?: number;
      paymentMethod?: string;
      roomNextStatus?: 'cleaning' | 'free';
      notes?: string;
    }
  ): Promise<any> => {
    const currentStay = stays.find((s) => s.id === stayId);
    if (!currentStay) throw new Error('Estadia não encontrada.');

    if (isGuest) {
      const res = checkoutGuestStay(stayId, options);
      toast({
        title: 'Check-out efetuado com sucesso!',
        description: `${currentStay.roomName} — ${res.pricing.billedHours}h faturadas (${res.pricing.totalAmountDue} MT)`,
      });
      return res;
    }

    if (!companyId) throw new Error('Empresa indisponível.');

    const result = await authedFetch('/api/stays/checkout', 'POST', {
      companyId,
      stayId,
      roomId: currentStay.roomId,
      amountPaid: options?.amountPaid,
      paymentMethod: options?.paymentMethod,
      roomNextStatus: options?.roomNextStatus || 'cleaning',
      notes: options?.notes,
    });

    const data = result.data;
    toast({
      title: 'Check-out concluído!',
      description: `${currentStay.roomName} libertado. Faturadas ${data?.pricing?.billedHours || 1}h (${data?.pricing?.totalAmountDue || 0} MT). Documento ${data?.guideNumber || ''}`,
    });

    return result;
  };

  // 7. Marcar Quarto como Limpo
  const markRoomCleaned = async (roomId: string): Promise<void> => {
    if (isGuest) {
      updateGuestRoom(roomId, {
        status: 'free',
        currentStayId: undefined,
      });
      toast({ title: 'Quarto limpo e disponível para novo hóspede!' });
      return;
    }

    if (!companyId) return;
    const roomRef = doc(db, `companies/${companyId}/rooms/${roomId}`);
    await updateDoc(roomRef, {
      status: 'free',
      currentStayId: null,
      updatedAt: serverTimestamp(),
    });
    toast({ title: 'Quarto limpo e disponível para novo hóspede!' });
  };

  // 8. Lançar Consumo de Bar / Serviços na Comanda do Quarto
  const addStayConsumption = async (
    stayId: string,
    item: {
      productId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }
  ): Promise<void> => {
    const currentStay = stays.find((s) => s.id === stayId);
    if (!currentStay) throw new Error('Estadia não encontrada.');

    const qty = Math.max(1, item.quantity || 1);
    const price = Math.max(0, item.unitPrice || 0);
    const totalPrice = qty * price;

    const newConsumption: StayConsumptionItem = {
      id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: item.productId,
      productName: item.productName,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      addedAt: new Date().toISOString(),
      addedBy: user?.id || 'unknown',
      addedByName: user?.username || 'Barman / Receção',
    };

    const updatedConsumptions = [...(currentStay.consumptions || []), newConsumption];
    const consumptionsTotal = updatedConsumptions.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const stayHoursTotal = (currentStay.contractedHours || 1) * (currentStay.ratePerHourApplied || 0);
    const newTotalDue = stayHoursTotal + consumptionsTotal;

    if (isGuest) {
      updateGuestStay(stayId, {
        consumptions: updatedConsumptions,
        totalAmountDue: newTotalDue,
      });
      toast({
        title: 'Consumo registado no quarto!',
        description: `${qty}× ${item.productName} (${formatCurrency(totalPrice)})`,
      });
      return;
    }

    if (!companyId || !user) throw new Error('Sessão indisponível.');

    const stayRef = doc(db, `companies/${companyId}/stays/${stayId}`);
    const staySnap = await getDoc(stayRef);
    if (!staySnap.exists()) throw new Error('Estadia não encontrada no servidor.');
    const stayData = staySnap.data() as Stay;

    const serverConsumptions = [...(stayData.consumptions || []), newConsumption];
    const serverConsumptionsTotal = serverConsumptions.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const serverStayHoursTotal = (stayData.contractedHours || 1) * (stayData.ratePerHourApplied || 0);
    const serverTotalDue = serverStayHoursTotal + serverConsumptionsTotal;

    await updateDoc(stayRef, {
      consumptions: serverConsumptions,
      totalAmountDue: serverTotalDue,
    });

    toast({
      title: 'Consumo registado no quarto!',
      description: `${qty}× ${item.productName} (${formatCurrency(totalPrice)})`,
    });
  };

  // 9. Lançar Múltiplos Consumos em Lote na Comanda do Quarto
  const addStayConsumptionsBulk = async (
    stayId: string,
    items: {
      productId?: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }[]
  ): Promise<void> => {
    if (!items || items.length === 0) return;
    const currentStay = stays.find((s) => s.id === stayId);
    if (!currentStay) throw new Error('Estadia não encontrada.');

    const newConsumptions: StayConsumptionItem[] = items.map((item, index) => {
      const qty = Math.max(1, item.quantity || 1);
      const price = Math.max(0, item.unitPrice || 0);
      return {
        id: `cons-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        productId: item.productId,
        productName: item.productName,
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price,
        addedAt: new Date().toISOString(),
        addedBy: user?.id || 'unknown',
        addedByName: user?.username || 'Barman / Receção',
      };
    });

    const addedTotal = newConsumptions.reduce((sum, c) => sum + c.totalPrice, 0);
    const updatedConsumptions = [...(currentStay.consumptions || []), ...newConsumptions];
    const consumptionsTotal = updatedConsumptions.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const stayHoursTotal = (currentStay.contractedHours || 1) * (currentStay.ratePerHourApplied || 0);
    const newTotalDue = stayHoursTotal + consumptionsTotal;

    if (isGuest) {
      updateGuestStay(stayId, {
        consumptions: updatedConsumptions,
        totalAmountDue: newTotalDue,
      });
      toast({
        title: `Consumos lançados no ${currentStay.roomName}!`,
        description: `${newConsumptions.length} itens adicionados (${formatCurrency(addedTotal)}). Serão cobrados no check-out.`,
      });
      return;
    }

    if (!companyId || !user) throw new Error('Sessão indisponível.');

    const stayRef = doc(db, `companies/${companyId}/stays/${stayId}`);
    const staySnap = await getDoc(stayRef);
    if (!staySnap.exists()) throw new Error('Estadia não encontrada no servidor.');
    const stayData = staySnap.data() as Stay;

    const serverConsumptions = [...(stayData.consumptions || []), ...newConsumptions];
    const serverConsumptionsTotal = serverConsumptions.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const serverStayHoursTotal = (stayData.contractedHours || 1) * (stayData.ratePerHourApplied || 0);
    const serverTotalDue = serverStayHoursTotal + serverConsumptionsTotal;

    await updateDoc(stayRef, {
      consumptions: serverConsumptions,
      totalAmountDue: serverTotalDue,
    });

    toast({
      title: `Consumos lançados no ${currentStay.roomName}!`,
      description: `${newConsumptions.length} itens adicionados (${formatCurrency(addedTotal)}). Serão cobrados no check-out.`,
    });
  };

  // 10. Remover Consumo da Comanda
  const removeStayConsumption = async (stayId: string, consumptionId: string): Promise<void> => {
    const currentStay = stays.find((s) => s.id === stayId);
    if (!currentStay) throw new Error('Estadia não encontrada.');

    const updatedConsumptions = (currentStay.consumptions || []).filter((c) => c.id !== consumptionId);
    const consumptionsTotal = updatedConsumptions.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
    const stayHoursTotal = (currentStay.contractedHours || 1) * (currentStay.ratePerHourApplied || 0);
    const newTotalDue = stayHoursTotal + consumptionsTotal;

    if (isGuest) {
      updateGuestStay(stayId, {
        consumptions: updatedConsumptions,
        totalAmountDue: newTotalDue,
      });
      toast({ title: 'Consumo removido da comanda do quarto.' });
      return;
    }

    if (!companyId || !user) throw new Error('Sessão indisponível.');

    const stayRef = doc(db, `companies/${companyId}/stays/${stayId}`);
    await updateDoc(stayRef, {
      consumptions: updatedConsumptions,
      totalAmountDue: newTotalDue,
    });

    toast({ title: 'Consumo removido da comanda do quarto.' });
  };

  // Métodos de Reservas Antecipadas
  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> => {
    const newBooking: Booking = {
      ...data,
      id: `book-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (isGuest) {
      addGuestBooking(newBooking);
      setBookings((prev) => [newBooking, ...prev]);
      return newBooking;
    }

    if (!companyId) throw new Error('Empresa não selecionada');
    const bookingsRef = collection(db, `companies/${companyId}/bookings`);
    const docRef = await addDoc(bookingsRef, {
      ...data,
      createdAt: serverTimestamp(),
    });
    newBooking.id = docRef.id;
    return newBooking;
  };

  const updateBookingStatus = async (bookingId: string, status: BookingStatus): Promise<void> => {
    if (isGuest) {
      updateGuestBooking(bookingId, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      return;
    }
    if (!companyId) return;
    const docRef = doc(db, `companies/${companyId}/bookings/${bookingId}`);
    await updateDoc(docRef, { status });
  };

  const cancelBooking = async (bookingId: string): Promise<void> => {
    await updateBookingStatus(bookingId, 'cancelled');
  };

  return (
    <RoomsContext.Provider
      value={{
        rooms,
        stays,
        openStays,
        loading,
        stats,
        addRoom,
        updateRoom,
        deleteRoom,
        checkInStay,
        extendStay,
        checkOutStay,
        markRoomCleaned,
        refreshRealtimeStatuses,
        addStayConsumption,
        addStayConsumptionsBulk,
        removeStayConsumption,
        bookings,
        addBooking,
        updateBookingStatus,
        cancelBooking,
      }}
    >
      {children}
    </RoomsContext.Provider>
  );
}

export function useRooms(): RoomsContextType {
  const context = useContext(RoomsContext);
  if (!context) {
    throw new Error('useRooms deve ser utilizado dentro de um RoomsProvider.');
  }
  return context;
}
