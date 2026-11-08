"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/context/crm-context';
import { useInventory } from '@/context/inventory-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function NewCustomerPage() {
    const router = useRouter();
    const { addCustomer } = useCRM();
    const { canEdit } = useInventory();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });

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
            await addCustomer(formData);
            toast({
                title: 'Cliente Adicionado',
                description: 'O registo do cliente foi guardado com sucesso.',
                className: 'border-emerald-500/50 text-emerald-500'
            });
            router.push('/customers');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Adicionar',
                description: error.message || 'Ocorreu um erro ao guardar o cliente.'
            });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Novo Cliente</h1>
                    <p className="text-muted-foreground text-sm">Adicione um novo cliente à base de dados para acompanhamento de vendas e histórico.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
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

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border">
                        <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/customers')}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting || !formData.name}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cliente Base
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
