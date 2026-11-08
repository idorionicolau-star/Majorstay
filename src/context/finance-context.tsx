'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Expense } from '@/lib/types';
import { isGuestCompany, getGuestExpenses, addGuestExpense, updateGuestExpense, deleteGuestExpense, GUEST_DATA_EVENT } from '@/lib/guest-mode';
import { useInventory } from '@/context/inventory-context';
import { db } from '@/firebase/index';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

interface FinanceContextType {
    expenses: Expense[];
    addExpense: (expenseData: Omit<Expense, 'id' | 'registeredBy'>) => Promise<void>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
    loading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
    const { companyId, user, canView } = useInventory();
    // só quem tem acesso ao Financeiro lê as despesas (uma escuta recusada pelas regras rebentava a app)
    const canFinance = !!user && canView('finance');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    const isGuest = isGuestCompany(companyId);

    useEffect(() => {
        if (isGuest) {
            const load = () => setExpenses(getGuestExpenses());
            load();
            setLoading(false);
            window.addEventListener(GUEST_DATA_EVENT, load);
            return () => window.removeEventListener(GUEST_DATA_EVENT, load);
        }

        if (!companyId || !canFinance) {
            setExpenses([]);
            setLoading(false);
            return;
        }

        const expensesRef = collection(db, `companies/${companyId}/expenses`);
        // Order inside memory or query? Query is better.
        const q = query(expensesRef, orderBy('date', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Expense[];
            setExpenses(expensesList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching expenses:", error);
            // Silent error or toast? Toast for visibility.
            // toast({ variant: "destructive", title: "Erro financeiro", description: "Falha ao carregar despesas." });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyId, canFinance, isGuest]);

    const addExpense = async (expenseData: Omit<Expense, 'id' | 'registeredBy'>) => {
        if (isGuest) {
            const newE: Expense = {
                id: `exp-${Date.now()}`,
                ...expenseData,
                registeredBy: user?.username || 'Gestor Comercial',
            };
            addGuestExpense(newE);
            toast({ title: 'Despesa registada', description: `${expenseData.description}` });
            return;
        }
        if (!companyId || !user) return;
        try {
            const expensesRef = collection(db, `companies/${companyId}/expenses`);
            await addDoc(expensesRef, {
                ...expenseData,
                registeredBy: user.username,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Despesa registada", description: `${expenseData.description}` });
        } catch (error) {
            console.error("Error adding expense:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível registar a despesa." });
            throw error;
        }
    };

    const updateExpense = async (id: string, data: Partial<Expense>) => {
        if (isGuest) {
            updateGuestExpense(id, data);
            toast({ title: "Despesa atualizada" });
            return;
        }
        if (!companyId) return;
        try {
            const expenseRef = doc(db, `companies/${companyId}/expenses`, id);
            await updateDoc(expenseRef, data);
            toast({ title: "Despesa atualizada" });
        } catch (error) {
            console.error("Error updating expense:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar a despesa." });
            throw error;
        }
    };

    const deleteExpense = async (id: string) => {
        if (isGuest) {
            deleteGuestExpense(id);
            toast({ title: "Despesa removida" });
            return;
        }
        if (!companyId) return;
        try {
            const expenseRef = doc(db, `companies/${companyId}/expenses`, id);
            await deleteDoc(expenseRef);
            toast({ title: "Despesa removida" });
        } catch (error) {
            console.error("Error deleting expense:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível remover a despesa." });
            throw error;
        }
    };

    return (
        <FinanceContext.Provider value={{ expenses, addExpense, updateExpense, deleteExpense, loading }}>
            {children}
        </FinanceContext.Provider>
    );
}

export const useFinance = () => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};
