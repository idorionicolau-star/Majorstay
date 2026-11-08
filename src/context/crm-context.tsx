'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Customer } from '@/lib/types';
import { isGuestCompany, getGuestCustomers, addGuestCustomer, updateGuestCustomer, deleteGuestCustomer, GUEST_DATA_EVENT } from '@/lib/guest-mode';
import { useInventory } from '@/context/inventory-context';
import { db } from '@/firebase/index';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

interface CRMContextType {
    customers: Customer[];
    addCustomer: (customerData: Omit<Customer, 'id' | 'totalPurchases' | 'lastVisit'>) => Promise<string | undefined>;
    updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;
    loading: boolean;
}

export const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
    const { companyId, user, canView } = useInventory();
    // Só quem usa clientes (Clientes, Vendas, Encomendas, Dashboard) precisa de os carregar.
    const allowed = !!user && (canView('customers') || canView('sales') || canView('orders') || canView('dashboard'));
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    // Um erro desliga o onSnapshot para sempre; este contador volta a ligá-lo.
    const [retry, setRetry] = useState(0);

    const isGuest = isGuestCompany(companyId);

    useEffect(() => {
        if (isGuest) {
            // dados do convidado: guardados no aparelho; voltam a ler-se sempre que mudam (ex.: uma venda soma ao cliente)
            const load = () => setCustomers(getGuestCustomers());
            load();
            setLoading(false);
            window.addEventListener(GUEST_DATA_EVENT, load);
            return () => window.removeEventListener(GUEST_DATA_EVENT, load);
        }

        if (!companyId || !allowed) {
            setCustomers([]);
            setLoading(false);
            return;
        }

        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        const customersRef = collection(db, `companies/${companyId}/customers`);
        const q = query(customersRef, orderBy('name'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const customersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Customer[];
            // Ordem alfabética sem distinguir maiúsculas/acentos ("sdf…" não vai para o fim).
            customersList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
            setCustomers(customersList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching customers:", error);
            // Tentar de novo (ex.: regras acabadas de publicar, ligação que voltou).
            retryTimer = setTimeout(() => setRetry((r) => r + 1), 15000);
            // Sem permissão não é um problema de ligação — não assustar o utilizador.
            if ((error as { code?: string }).code === 'permission-denied') {
                setLoading(false);
                return;
            }
            toast({
                variant: "destructive",
                title: "Erro ao carregar clientes",
                description: "Verifique a sua conexão.",
            });
            setLoading(false);
        });

        return () => { unsubscribe(); if (retryTimer) clearTimeout(retryTimer); };
    }, [companyId, allowed, retry, isGuest]);

    const addCustomer = async (customerData: Omit<Customer, 'id' | 'totalPurchases' | 'lastVisit'>): Promise<string | undefined> => {
        if (isGuest) {
            const newC: Customer = {
                id: `cust-${Date.now()}`,
                name: customerData.name,
                phone: customerData.phone,
                email: customerData.email,
                notes: customerData.notes,
                totalPurchases: 0,
                lastVisit: new Date().toISOString(),
            };
            addGuestCustomer(newC);
            toast({ title: 'Cliente adicionado com sucesso!' });
            return newC.id;
        }
        if (!companyId || !user) return undefined;
        try {
            const customersRef = collection(db, `companies/${companyId}/customers`);
            const docRef = await addDoc(customersRef, {
                ...customerData,
                totalPurchases: 0,
                lastVisit: new Date().toISOString(),
                createdBy: user.username,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Cliente adicionado", description: `${customerData.name} foi registado com sucesso.` });
            return docRef.id;
        } catch (error) {
            console.error("Error adding customer:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar o cliente." });
            throw error;
        }
    };

    const updateCustomer = async (id: string, data: Partial<Customer>) => {
        if (isGuest) {
            updateGuestCustomer(id, data);
            toast({ title: "Cliente atualizado" });
            return;
        }
        if (!companyId) return;
        try {
            const customerRef = doc(db, `companies/${companyId}/customers`, id);
            await updateDoc(customerRef, data);
            toast({ title: "Cliente atualizado" });
        } catch (error) {
            console.error("Error updating customer:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o cliente." });
            throw error;
        }
    };

    const deleteCustomer = async (id: string) => {
        if (isGuest) {
            deleteGuestCustomer(id);
            toast({ title: "Cliente removido" });
            return;
        }
        if (!companyId) return;
        try {
            const customerRef = doc(db, `companies/${companyId}/customers`, id);
            await deleteDoc(customerRef);
            toast({ title: "Cliente removido" });
        } catch (error) {
            console.error("Error deleting customer:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível remover o cliente." });
            throw error;
        }
    };

    return (
        <CRMContext.Provider value={{ customers, addCustomer, updateCustomer, deleteCustomer, loading }}>
            {children}
        </CRMContext.Provider>
    );
}

export const useCRM = () => {
    const context = useContext(CRMContext);
    if (context === undefined) {
        throw new Error('useCRM must be used within a CRMProvider');
    }
    return context;
};
