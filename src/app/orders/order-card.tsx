"use client";

import type { Order, Sale } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, ClipboardList, Play, Check, CircleHelp, PlusCircle, TrendingUp, Trash2, Printer } from "lucide-react";
import { cn, downloadSaleDocument } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { AddProductionLogDialog } from "@/components/orders/add-production-log-dialog";
import { FinalizeOrderDialog } from "@/components/orders/finalize-order-dialog";
import { differenceInDays, addDays } from 'date-fns';
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
import { useState } from "react";


interface OrderCardProps {
    order: Order;
    onUpdateStatus: (orderId: string, newStatus: 'Pendente' | 'Em produção' | 'Concluída') => void;
    onAddProductionLog: (orderId: string, logData: { quantity: number; notes?: string; }) => void;
    canEdit: boolean;
    associatedSale?: Sale;
    companyData?: any;
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
        color: 'text-emerald-600',
        icon: Check,
    }
};



export function OrderCard({ order, onUpdateStatus, onAddProductionLog, canEdit, associatedSale, companyData }: OrderCardProps) {
    const { icon: StatusIcon, color: statusColor } = statusConfig[order.status];
    const progress = order.quantity > 0 ? (order.quantityProduced / order.quantity) * 100 : 0;
    const remainingQuantity = order.quantity - order.quantityProduced;

    const calculateEstimatedCompletionDate = () => {
        if (!order.productionStartDate || order.quantityProduced <= 0) {
            return null;
        }

        const startDate = new Date(order.productionStartDate);
        const today = new Date();
        const daysInProduction = differenceInDays(today, startDate) + 1; // +1 to include the start day

        if (daysInProduction <= 0) return null;

        const dailyAverage = order.quantityProduced / daysInProduction;

        if (dailyAverage <= 0) return null;

        const remainingDays = remainingQuantity / dailyAverage;
        const estimatedDate = addDays(today, Math.ceil(remainingDays));

        return estimatedDate;
    };


    const estimatedCompletionDate = calculateEstimatedCompletionDate();


    return (
        <Card className="glass-card flex flex-col h-full group p-4 shadow-sm">
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
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 p-2">
                <div className="relative">
                    <Progress value={progress} className="h-8" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-xs font-bold drop-shadow-md">
                            {order.quantityProduced} / {order.quantity} ({progress.toFixed(0)}%)
                        </span>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-muted-foreground">
                    Faltam {Number(remainingQuantity.toFixed(2))} {order.unit}
                </p>

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
            {canEdit && <CardFooter className="flex flex-col sm:flex-row justify-center gap-2 p-2 pt-4">
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
                    <div className="w-full space-y-2">
                        <p className="text-sm text-muted-foreground text-center">Produção Finalizada.</p>
                        {associatedSale && (
                            <FinalizeOrderDialog
                                order={order}
                                saleAmountPaid={associatedSale.amountPaid || 0}
                                saleTotal={associatedSale.totalValue}
                            />
                        )}
                    </div>
                )}
                {order.status === 'Entregue' && (
                    <div className="w-full space-y-2">
                        <p className="text-sm font-bold text-emerald-600 text-center flex items-center justify-center gap-1 py-1">
                            <Check className="h-4 w-4" /> Encomenda Entregue
                        </p>
                        {associatedSale && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9"
                                onClick={() => downloadSaleDocument(associatedSale, companyData!)}
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Talão
                            </Button>
                        )}
                    </div>
                )}
            </CardFooter>}
        </Card>
    );
}
