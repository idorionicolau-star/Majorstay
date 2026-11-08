"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCRM } from '@/context/crm-context';
import { useInventory } from '@/context/inventory-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';
import { Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function EditCustomerPage() {
    const router = useRouter();
    const params = useParams();
    const customerId = params.id as string;

    const { customers, updateCustomer, deleteCustomer, loading } = useCRM();
    const { canEdit } = useInventory();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });

    useEffect(() => {
        if (!loading && customers.length > 0) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                setFormData({
                    name: customer.name,
                    phone: customer.phone || '',
                    email: customer.email || '',
                    notes: customer.notes || '',
                });
            } else {
                router.push('/customers');
            }
        }
    }, [customerId, customers, loading, router]);


    const namePlaceholder = useDynamicPlaceholder('person');
    const phonePlaceholder = useDynamicPlaceholder('phone');
    const emailPlaceholder = useDynamicPlaceholder('email');
    const notesPlaceholder = useDynamicPlaceholder('generic');

    if (!canEdit('customers')) {
        return <div className="p-8 text-center text-red-500">Acesso negado.</div>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        setIsSubmitting(true);
        try {
            await updateCustomer(customerId, formData);
            toast({
                title: 'Cliente Atualizado',
                description: 'As alterações foram guardadas com sucesso.',
                className: 'border-emerald-500/50 text-emerald-500'
            });
            router.push('/customers');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Atualizar',
                description: error.message || 'Ocorreu um erro ao atualizar o cliente.'
            });
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteCustomer(customerId);
            toast({
                title: 'Cliente Removido',
                description: 'O cliente foi removido da base de dados.'
            });
            router.push('/customers');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Remover',
                description: error.message || 'Não foi possível remover este cliente.'
            });
            setIsDeleting(false);
        }
    };

    if (loading || !formData.name) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Editar Cliente</h1>
                    <p className="text-muted-foreground text-sm">Atualize as informações de contacto ou notas do cliente.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg relative">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder={namePlaceholder}
                            className="bg-background/50 h-12"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone (Opcional)</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder={phonePlaceholder}
                                className="bg-background/50 h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail (Opcional)</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder={emailPlaceholder}
                                className="bg-background/50 h-12"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas ou Instruções (Opcional)</Label>
                        <Input
                            id="notes"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder={notesPlaceholder}
                            className="bg-background/50 h-12"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-border gap-4">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 order-2 sm:order-1">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remover Cliente
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tem a certeza absoluta?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isto apaga permanentemente o registo do cliente base e as suas informações de contacto. O histórico de documentos de vendas já emitidos não será modificado.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, eliminar"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <div className="flex flex-col sm:flex-row items-center gap-3 order-1 sm:order-2 w-full sm:w-auto">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/customers')}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting || !formData.name}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Alterações
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </div>
    );
}
