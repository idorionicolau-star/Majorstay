'use client';

import { useState, useMemo } from 'react';
import { useInventory } from '@/context/inventory-context';
import { useFinance } from '@/context/finance-context';
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
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cardMoneySize, cn, formatCardMoney, formatCurrency, normalizeString } from '@/lib/utils';
import { Search, Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Trash2, Printer, Download, CreditCard, ShoppingBag, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { pt, ptBR } from 'date-fns/locale';
import { isCountableSale, saleIncome } from '@/lib/sale-filters';
import { printFinancialReport } from '@/lib/report-utils';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { openSale } from '@/components/sales/sale-sheet';
import { ReportsTabs } from '@/components/layout/section-tabs';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function FinancePage() {
    const { canView, sales, companyData, confirmAction } = useInventory();
    const { expenses, addExpense, deleteExpense, loading } = useFinance();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [formData, setFormData] = useState({ description: '', amount: '', category: 'Outros', date: format(new Date(), 'yyyy-MM-dd') });

    // Date filtering state
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [period, setPeriod] = useState<Period>('daily');

    // Calculate generic date boundaries
    const dateBoundaries = useMemo(() => {
        if (!selectedDate) return { start: new Date(0), end: new Date() };
        let start: Date;
        let end: Date;

        switch (period) {
            case 'daily':
                start = startOfDay(selectedDate);
                end = endOfDay(selectedDate);
                break;
            case 'weekly':
                start = startOfWeek(selectedDate, { locale: pt });
                end = endOfWeek(selectedDate, { locale: pt });
                break;
            case 'monthly':
                start = startOfMonth(selectedDate);
                end = endOfMonth(selectedDate);
                break;
            case 'yearly':
                start = startOfYear(selectedDate);
                end = endOfYear(selectedDate);
                break;
        }
        return { start, end };
    }, [selectedDate, period]);

    const periodLabel = useMemo(() => {
        switch (period) {
            case 'daily': return '(Dia)';
            case 'weekly': return '(Semana)';
            case 'monthly': return '(Mês)';
            case 'yearly': return '(Ano)';
            default: return '';
        }
    }, [period]);

    // Filter using boundaries
    const periodSales = sales.filter(s => isCountableSale(s) && isWithinInterval(new Date(s.date), dateBoundaries));
    const periodExpenses = expenses.filter(e => isWithinInterval(new Date(e.date), dateBoundaries));

    const totalIncome = periodSales.reduce((acc, s) => acc + saleIncome(s), 0);
    const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    // Filter transactions for tables based on period & search term
    const filteredExpenses = periodExpenses.filter(e =>
        normalizeString(e.description).includes(normalizeString(searchTerm)) ||
        normalizeString(e.category).includes(normalizeString(searchTerm))
    );

    const filteredSales = periodSales.filter(s =>
        normalizeString(s.productName).includes(normalizeString(searchTerm)) ||
        (s.clientName && normalizeString(s.clientName).includes(normalizeString(searchTerm))) ||
        (s.guideNumber && normalizeString(s.guideNumber).includes(normalizeString(searchTerm)))
    );

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) return;
        const amount = parseFloat(formData.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast({ variant: 'destructive', title: 'Valor inválido', description: 'O valor da despesa tem de ser maior que zero.' });
            return;
        }
        try {
            await addExpense({
                description: formData.description,
                amount,
                category: formData.category,
                // a data escolhida (ao meio-dia, para o fuso horário não a empurrar para outro dia); sem data = agora
                date: formData.date ? new Date(`${formData.date}T12:00:00`).toISOString() : new Date().toISOString(),
                status: 'Pago', // Default to Paid for simplicity now
            });
            setIsAddOpen(false);
            setFormData({ description: '', amount: '', category: 'Outros', date: format(new Date(), 'yyyy-MM-dd') });
        } catch (e) { }
    };

    if (!canView('finance')) {
        return <div className="p-8 text-center">Você não tem permissão para aceder a este módulo.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <ReportsTabs />
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-headline text-slate-900 dark:text-white">Fluxo Financeiro</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Controle de receitas, despesas e margens.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button data-tour="fin-expense" className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-95">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Registar Despesa
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Registar Nova Despesa</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddSubmit} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Descrição</Label>
                                        <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required placeholder="Ex: Conta de Luz" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Valor (MZN)</Label>
                                            <Input type="number" step="0.01" min="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Categoria</Label>
                                            <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Salários">Salários</SelectItem>
                                                    <SelectItem value="Aluguel">Aluguel</SelectItem>
                                                    <SelectItem value="Utilidades">Utilidades</SelectItem>
                                                    <SelectItem value="Matéria-Prima">Matéria-Prima</SelectItem>
                                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                                    <SelectItem value="Impostos">Impostos</SelectItem>
                                                    <SelectItem value="Outros">Outros</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Data da despesa</Label>
                                        <Input type="date" max={format(new Date(), 'yyyy-MM-dd')} value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" className="w-full bg-red-500 hover:bg-red-600">Confirmar Despesa</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Period Selector and Action Buttons */}
                <div data-tour="fin-period" className="flex flex-col w-full gap-2 sm:flex-row sm:flex-wrap md:items-center">
                    <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
                        <SelectTrigger className="h-10 w-full sm:w-[150px]">
                            <SelectValue placeholder="Selecionar Período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="w-full sm:w-auto">
                        <DatePicker date={selectedDate} setDate={setSelectedDate} />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2" data-tour="fin-print">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                        onClick={() => printFinancialReport({
                            companyName: companyData?.name || 'Minha Empresa',
                            period: selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "N/A",
                            totalIncome,
                            totalExpenses,
                            netProfit,
                            sales: periodSales,
                            expenses: periodExpenses
                        })}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                            try {
                                const { generateFinancialReportPDF } = await import('@/lib/pdf-generator');
                                generateFinancialReportPDF(
                                    companyData?.name || 'Minha Empresa',
                                    selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : '',
                                    totalIncome,
                                    totalExpenses,
                                    netProfit,
                                    periodSales,
                                    periodExpenses
                                );
                                toast({ title: "Relatório gerado", description: "Relatório financeiro gerado com sucesso!" });
                            } catch (error) {
                                console.error("Erro ao gerar PDF:", error);
                                toast({ variant: "destructive", title: "Erro", description: "Erro ao gerar o relatório PDF." });
                            }
                        }}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar PDF
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            {/* três colunas só com largura: num tablet ao alto os cartões ficavam com ~130 px e o valor partia-se a meio */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="fin-kpis">
                <Card className="border-green-100 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Entradas {periodLabel}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("font-bold tabular-nums [overflow-wrap:anywhere] text-green-700 dark:text-green-300", cardMoneySize(formatCardMoney(totalIncome)))} title={formatCurrency(totalIncome)}>{formatCardMoney(totalIncome)}</div>
                        <p className="text-xs text-green-600/80 mt-1">{periodSales.length} vendas registadas</p>
                    </CardContent>
                </Card>

                <Card className="border-red-100 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" /> Saídas {periodLabel}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("font-bold tabular-nums [overflow-wrap:anywhere] text-red-700 dark:text-red-300", cardMoneySize(formatCardMoney(totalExpenses)))} title={formatCurrency(totalExpenses)}>{formatCardMoney(totalExpenses)}</div>
                        <p className="text-xs text-red-600/80 mt-1">{periodExpenses.length} despesas registadas</p>
                    </CardContent>
                </Card>

                <Card className={`border-slate-200 dark:border-slate-800 ${netProfit >= 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-orange-50/50 dark:bg-orange-900/10'}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Lucro Líquido {periodLabel}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("font-bold tabular-nums [overflow-wrap:anywhere]", cardMoneySize(formatCardMoney(netProfit)), netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-600')} title={formatCurrency(netProfit)}>
                            {formatCardMoney(netProfit)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Margem operacional do período</p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions List */}
            <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold font-headline">Transações</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Pesquisar..."
                            className="pl-10 sm:pl-10 h-10 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <Tabs defaultValue="entradas" className="w-full">
                    <TabsList data-tour="fin-tabs" className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="entradas" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-400">
                            <TrendingUp className="w-4 h-4 mr-2" /> Entradas
                        </TabsTrigger>
                        <TabsTrigger value="saidas" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800 dark:data-[state=active]:bg-red-900/30 dark:data-[state=active]:text-red-400">
                            <TrendingDown className="w-4 h-4 mr-2" /> Saídas
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="entradas" className="mt-0">
                        {/* Desktop Table for Entradas */}
                        <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-green-50/50 dark:bg-green-900/10">
                                    <TableRow>
                                        <TableHead>Descrição (Venda)</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Meio Pagto.</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Data</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSales.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                                Nenhuma venda registada para este termo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSales.map((sale) => (
                                            <TableRow key={sale.id} data-tour="finance-sale" onClick={() => openSale(sale.id)} className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <TableCell className="font-medium">
                                                    Venda: {sale.productName} <span className="text-xs text-slate-400 ml-1">({sale.quantity} unid.)</span>
                                                </TableCell>
                                                <TableCell>
                                                    {sale.clientName || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {sale.paymentMethod || 'Diversos'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-green-600 dark:text-green-400">
                                                    +{formatCurrency(saleIncome(sale))}
                                                    {saleIncome(sale) < sale.totalValue && <div className="text-xs font-medium text-amber-600">falta {formatCurrency(sale.totalValue - saleIncome(sale))}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(sale.date), "d MMM yyyy", { locale: ptBR })}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {/* Mobile Cards Entradas */}
                        <div className="md:hidden space-y-3">
                            {filteredSales.length === 0 ? (
                                <Card className="p-8 text-center text-slate-500 bg-white/50 dark:bg-slate-900/50 border-dashed">
                                    Nenhuma entrada encontrada.
                                </Card>
                            ) : (
                                filteredSales.map((sale) => (
                                    <Card key={sale.id} data-tour="finance-sale" role="button" onClick={() => openSale(sale.id)} className="cursor-pointer overflow-hidden border-slate-200 dark:border-green-800/30 active:bg-slate-50 dark:active:bg-slate-800/50">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{sale.productName}</h3>
                                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                                                        {sale.clientName || 'Cliente Balcão'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-green-600 dark:text-green-400">
                                                        +{formatCurrency(saleIncome(sale))}
                                                    </p>
                                                    {saleIncome(sale) < sale.totalValue && <p className="text-xs font-medium text-amber-600">falta {formatCurrency(sale.totalValue - saleIncome(sale))}</p>}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {format(new Date(sale.date), "d MMM yyyy", { locale: ptBR })}
                                                </div>
                                                <div className="flex items-center gap-1 text-primary text-xs font-medium">
                                                    <ShoppingBag className="w-3.5 h-3.5" /> Abrir venda <ChevronRight className="w-3.5 h-3.5" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="saidas" className="mt-0">
                        {/* Desktop Table for Saídas */}
                        <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-red-50/50 dark:bg-red-900/10">
                                    <TableRow>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredExpenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                                {loading ? 'A carregar...' : 'Nenhuma despesa registada.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredExpenses.map((expense) => (
                                            <TableRow key={expense.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <TableCell className="font-medium">
                                                    {expense.description}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {expense.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-red-600 dark:text-red-400">
                                                    -{formatCurrency(expense.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-slate-500 text-sm">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(expense.date), "d MMM yyyy", { locale: ptBR })}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        if (confirmAction) {
                                                            confirmAction(async () => {
                                                                await deleteExpense(expense.id);
                                                            }, "Apagar Despesa", `Tem a certeza que quer apagar a despesa "${expense.description}"? Esta ação não pode ser desfeita.`);
                                                        }
                                                    }} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {/* Mobile Cards Saídas */}
                        <div className="md:hidden space-y-3">
                            {filteredExpenses.length === 0 ? (
                                <Card className="p-8 text-center text-slate-500 bg-white/50 dark:bg-slate-900/50 border-dashed">
                                    {loading ? 'A carregar...' : 'Nenhuma despesa encontrada.'}
                                </Card>
                            ) : (
                                filteredExpenses.map((expense) => (
                                    <Card key={expense.id} className="overflow-hidden border-slate-200 dark:border-red-800/30">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{expense.description}</h3>
                                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                        {expense.category}
                                                    </span>
                                                </div>
                                                <p className="text-lg font-black text-red-600 dark:text-red-400">
                                                    -{formatCurrency(expense.amount)}
                                                </p>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {format(new Date(expense.date), "d MMM yyyy", { locale: ptBR })}
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    if (confirmAction) {
                                                        confirmAction(async () => {
                                                            await deleteExpense(expense.id);
                                                        }, "Apagar Despesa", `Tem a certeza que quer apagar a despesa "${expense.description}"? Esta ação não pode ser desfeita.`);
                                                    }
                                                }} className="h-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                                    Apagar
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
