"use client";

import type { Order, Sale } from "@/lib/types";
import { FinalizeOrderDialog } from "./finalize-order-dialog";
import { PartialPickupDialog } from "./partial-pickup-dialog";
import { orderDelivered, orderToProduce } from "@/lib/order-stock";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, Play, Check, CircleHelp, TrendingUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { AddProductionLogDialog } from "./add-production-log-dialog";
import { differenceInDays, addDays } from 'date-fns';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OrderCardProps {
    order: Order;
    onUpdateStatus: (orderId: string, newStatus: 'Pendente' | 'Em produção' | 'Concluída') => void;
    onAddProductionLog: (orderId: string, logData: { quantity: number; notes?: string; }) => void;
    onDeleteOrder: (orderId: string) => void;
    associatedSale?: Sale;
    canEdit: boolean;
}

const statusConfig = {
    'Pendente': {
        color: 'text-[hsl(var(--chart-4))]',
        icon: CircleHelp,
    },
    'Em produção': {
        color: 'text-primary',
        icon: Play,
    },
    'Concluída': {
        color: 'text-[hsl(var(--chart-2))]',
        icon: Check,
    },
    'Entregue': {
        color: 'text-muted-foreground',
        icon: Check,
    }
};

export function OrderCard({ order, onUpdateStatus, onAddProductionLog, onDeleteOrder, canEdit, associatedSale }: OrderCardProps) {
    const { icon: StatusIcon, color: statusColor } = statusConfig[order.status];
    // pronto = produzido (no stock) + o que o cliente já levou
    const delivered = orderDelivered(order);
    const ready = Math.min(order.quantity, (order.quantityProduced || 0) + delivered);
    const progress = order.quantity > 0 ? (ready / order.quantity) * 100 : 0;
    const remainingQuantity = orderToProduce(order);

    const calculateEstimatedCompletionDate = () => {
        if (!order.productionStartDate || order.quantityProduced <= 0) {
            return null;
        }

        const startDate = new Date(order.productionStartDate);
        const today = new Date();
        const daysInProduction = differenceInDays(today, startDate) + 1;

        if (daysInProduction <= 0) return null;

        const dailyAverage = order.quantityProduced / daysInProduction;

        if (dailyAverage <= 0) return null;

        const remainingDays = remainingQuantity / dailyAverage;
        const estimatedDate = addDays(today, Math.ceil(remainingDays));

        return estimatedDate;
    };

    const estimatedCompletionDate = calculateEstimatedCompletionDate();

    return (
        <Card data-tour="orders-card" className="glass-card flex flex-col h-full group p-4 shadow-sm">
            <CardHeader className="p-2">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base font-bold leading-tight flex items-center gap-2">
                            <StatusIcon className={cn("h-5 w-5", statusColor)} />
                            {order.productName}
                        </CardTitle>
                        <CardDescription className="text-xs pt-1">Encomenda #{order.id.slice(-6).toUpperCase()}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className={cn("inline-flex items-center gap-2 text-xs font-bold", statusColor)}>
                            <span>{order.status}</span>
                        </div>
                        {canEdit && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onDeleteOrder(order.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Apagar Encomenda</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Apagar Encomenda</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 p-2">
                <div className="relative">
                    <Progress data-tour="orders-progress" value={progress} className="h-8" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xs font-bold drop-shadow-md">
                            {Number(ready.toFixed(2))} / {order.quantity} ({progress.toFixed(0)}%)
                        </span>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-muted-foreground">
                    {remainingQuantity > 0 ? `Faltam produzir ${Number(remainingQuantity.toFixed(2))} ${order.unit}` : 'Tudo produzido'}
                </p>
                {delivered > 0 && order.status !== 'Entregue' && (
                    <p className="text-center text-sm font-semibold text-emerald-600" data-tour="orders-delivered">
                        Já levou {Number(delivered.toFixed(2))} {order.unit} · faltam levar {Number((order.quantity - delivered).toFixed(2))}
                    </p>
                )}

                <div className="text-sm text-muted-foreground space-y-1.5">
                    {order.clientName && (
                        <div className="flex items-center gap-2">
                            <User size={14} />
                            <span className="font-semibold">{order.clientName}</span>
                        </div>
                    )}
                    {order.deliveryDate && (
                        <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span className="font-semibold">Entrega: {new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    )}
                    {estimatedCompletionDate && order.status === 'Em produção' && (
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <TrendingUp size={14} />
                            <span>Previsão: {estimatedCompletionDate.toLocaleDateString('pt-BR')}</span>
                        </div>
                    )}
                </div>
            </CardContent>
            {canEdit && <CardFooter data-tour="orders-actions" className="flex flex-wrap justify-center gap-2 p-2 pt-4 [&>*]:min-w-[7.5rem] [&>*]:flex-1">
                {order.status !== 'Entregue' && <PartialPickupDialog order={order} />}
                {order.status === 'Pendente' && (
                    <Button onClick={() => onUpdateStatus(order.id, 'Em produção')} className="flex-1" variant="outline">
                        <Play className="mr-2 h-4 w-4" />
                        Iniciar Produção
                    </Button>
                )}
                {order.status === 'Em produção' && (
                    <>
                        <AddProductionLogDialog order={order} onAddLog={onAddProductionLog} />
                        <Button onClick={() => onUpdateStatus(order.id, 'Concluída')} className="flex-1" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Concluir
                        </Button>
                    </>
                )}
                {order.status === 'Concluída' && (
                    // Produção pronta: falta o cliente levantar. Este botão entrega, recebe o resto do
                    // pagamento, tira do stock e liberta a reserva. (Antes não havia botão nenhum aqui.)
                    <div className="w-full space-y-2">
                        <p className="text-center text-sm text-muted-foreground">Produção pronta — à espera do cliente.</p>
                        <FinalizeOrderDialog
                            order={order}
                            saleAmountPaid={associatedSale?.amountPaid ?? 0}
                            saleTotal={associatedSale?.totalValue ?? order.totalValue ?? 0}
                        />
                    </div>
                )}
                {order.status === 'Entregue' && (
                    <p className="w-full text-center text-sm font-semibold text-emerald-600">Encomenda entregue ao cliente.</p>
                )}
            </CardFooter>}
        </Card>
    );
}
