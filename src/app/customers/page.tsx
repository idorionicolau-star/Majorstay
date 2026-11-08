'use client';

import { useState, useMemo } from 'react';
import { useInventory } from '@/context/inventory-context';
import { useCRM } from '@/context/crm-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Plus, User, Phone, Mail, Calendar, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { isCountableSale, saleCustomerId } from '@/lib/sale-filters';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';
import { useFuse } from '@/hooks/use-fuse';
import { openSale } from '@/components/sales/sale-sheet';

export default function CustomersPage() {
    const { canView, companyData, sales, confirmAction } = useInventory();
    const { customers, deleteCustomer, loading } = useCRM();
    const router = useRouter();

    // Vindo de um aviso (ex.: diagnóstico): abre já filtrado pelo cliente.
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('cliente') || '');
    const [viewingCustomer, setViewingCustomer] = useState<any>(null);
    const searchPlaceholder = useDynamicPlaceholder('person');

    const filteredCustomers = useFuse(customers, searchTerm, { keys: ['name', 'phone', 'email'] });

    // As vendas de cada cliente: pelo customerId, ou pelo nome nas que só o guardaram (ex.: encomendas antigas)
    const salesByCustomer = useMemo(() => {
        const by = new Map<string, typeof sales>();
        for (const sale of sales) {
            if (!isCountableSale(sale)) continue;
            const id = saleCustomerId(sale, customers);
            if (!id) continue;
            by.set(id, [...(by.get(id) || []), sale]);
        }
        return by;
    }, [sales, customers]);

    // Compute customer stats from actual sales data
    const customerStats = useMemo(() => {
        const stats: Record<string, { totalPurchases: number; lastVisit: string | null }> = {};
        for (const [id, list] of salesByCustomer) {
            stats[id] = {
                totalPurchases: list.reduce((t, s) => t + (s.totalValue || 0), 0),
                lastVisit: list.reduce<string | null>((d, s) => (!d || s.date > d ? s.date : d), null),
            };
        }
        return stats;
    }, [salesByCustomer]);

    const getCustomerHistory = (customerId: string) => {
        return [...(salesByCustomer.get(customerId) || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    if (!canView('customers')) {
        return <div className="p-8 text-center">Você não tem permissão para aceder a este módulo.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-900 dark:text-white">Gestão de Clientes</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Base de clientes e histórico de compras.
                        </p>
                    </div>
                    <Button data-tour="cust-add" onClick={() => router.push('/customers/new')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Cliente
                    </Button>
                </div>
            </div>

            {/* Stats/Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 shadow-sm border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Clientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold font-headline text-slate-900 dark:text-white">{loading ? '...' : customers.length}</div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 flex items-end">
                    <div className="relative w-full" data-tour="cust-search">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder={searchPlaceholder}
                            className="pl-10 sm:pl-12 h-12 text-lg bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 focus-visible:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />

                    </div>
                </div>
            </div>

            {/* Table */}
            {/* Desktop Table */}
            <div data-tour="cust-list" className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Total Comprado</TableHead>
                            <TableHead>Última Visita</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                    {loading ? 'A carregar...' : 'Nenhum cliente encontrado.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow key={customer.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs uppercase">
                                                {customer.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-slate-900 dark:text-white font-headline">{customer.name}</span>
                                                {customer.notes && <span className="text-xs text-slate-400 truncate max-w-[150px]">{customer.notes}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm text-slate-500">
                                            {customer.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</div>}
                                            {customer.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</div>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                            {formatCurrency(customerStats[customer.id]?.totalPurchases || 0, { compact: true })}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-slate-500 text-sm">
                                            <Calendar className="w-3 h-3" />
                                            {(customerStats[customer.id]?.lastVisit || customer.lastVisit) ? format(new Date(customerStats[customer.id]?.lastVisit || customer.lastVisit), "d MMM yyyy", { locale: ptBR }) : '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => setViewingCustomer(customer)} className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                                                <User className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => router.push(`/customers/${customer.id}/edit`)} className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4" data-tour="cust-list">
                {filteredCustomers.length === 0 ? (
                    <Card className="p-8 text-center text-slate-500 bg-white/50 dark:bg-slate-900/50 border-dashed">
                        {loading ? 'A carregar...' : 'Nenhum cliente encontrado.'}
                    </Card>
                ) : (
                    filteredCustomers.map((customer) => (
                        <Card key={customer.id} className="overflow-hidden border-slate-200 dark:border-slate-800">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold uppercase transition-transform active:scale-90" onClick={() => setViewingCustomer(customer)}>
                                            {customer.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{customer.name}</h3>
                                            <span className="text-xs text-slate-500">{customer.phone || 'Sem telefone'}</span>
                                        </div>
                                    </div>
                                    <div className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-bold font-mono">
                                        {formatCurrency(customerStats[customer.id]?.totalPurchases || 0, { compact: true })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Última visita: {(customerStats[customer.id]?.lastVisit || customer.lastVisit) ? format(new Date(customerStats[customer.id]?.lastVisit || customer.lastVisit), "d/MM/yy") : '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">{customer.email || '-'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 h-9" onClick={() => setViewingCustomer(customer)}>
                                        <User className="h-4 w-4 mr-2" /> Histórico
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => router.push(`/customers/${customer.id}/edit`)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>



            {/* History Dialog */}
            <Dialog open={!!viewingCustomer} onOpenChange={(open) => !open && setViewingCustomer(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            Histórico de {viewingCustomer?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Total Gasto</p>
                                <p className="text-lg font-bold text-primary">{formatCurrency(customerStats[viewingCustomer?.id]?.totalPurchases || 0)}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Vendas</p>
                                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                    {viewingCustomer ? getCustomerHistory(viewingCustomer.id).length : 0}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-center">
                                <p className="text-xs text-slate-500 uppercase font-bold">Última Visita</p>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                                    {viewingCustomer?.lastVisit ? format(new Date(viewingCustomer.lastVisit), "d MMM yy", { locale: ptBR }) : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Compras Recentes</h3>
                            <div className="space-y-2">
                                {viewingCustomer && getCustomerHistory(viewingCustomer.id).length > 0 ? (
                                    getCustomerHistory(viewingCustomer.id).slice(0, 10).map(sale => (
                                        <button type="button" key={sale.id} data-tour="customer-sale" onClick={() => openSale(sale.id)} className="flex w-full text-left justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{sale.productName} <span className="text-slate-400 text-xs">x{sale.quantity}</span></span>
                                                <span className="text-xs text-slate-500">{format(new Date(sale.date), "d MMM yyyy HH:mm", { locale: ptBR })} • {sale.guideNumber}</span>
                                            </div>
                                            <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(sale.totalValue)}</span>
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 text-sm py-4">Sem registo de compras.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
