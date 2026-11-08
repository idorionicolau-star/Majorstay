
"use client"

import { ColumnDef } from "@tanstack/react-table";
import { StockMovement, MovementType } from "@/lib/types";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Pencil } from "lucide-react";
import { format } from 'date-fns';
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface ColumnsOptions {
    locationMap: Map<string, string>;
}

const MovementTypeCell = ({ type }: { type: MovementType }) => {
    const config = {
        IN: { icon: ArrowDownLeft, color: "text-green-500", label: "Entrada" },
        OUT: { icon: ArrowUpRight, color: "text-red-500", label: "Saída" },
        TRANSFER: { icon: ArrowRightLeft, color: "text-blue-500", label: "Transferência" },
        ADJUSTMENT: { icon: Pencil, color: "text-yellow-500", label: "Ajuste" }
    };
    const { icon: Icon, color, label } = config[type];
    return (
        <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", color)} />
            <span className="font-bold">{label}</span>
        </div>
    );
}

const QuantityCell = ({ quantity, type }: { quantity: number, type: MovementType }) => {
    const isOut = type === 'OUT' || (type === 'ADJUSTMENT' && quantity < 0);
    const displayQuantity = quantity > 0 && !isOut ? `+${quantity}` : quantity;
    return (
        <span className={cn(
            "font-mono font-bold",
            isOut ? "text-red-500" : "text-green-500"
        )}>
            {displayQuantity}
        </span>
    );
};

const LocationCell = ({ movement, locationMap }: { movement: StockMovement, locationMap: Map<string, string> }) => {
    const { type, fromLocationId, toLocationId } = movement;
    const from = fromLocationId ? locationMap.get(fromLocationId) || fromLocationId : 'N/A';
    const to = toLocationId ? locationMap.get(toLocationId) || toLocationId : 'N/A';

    if (type === 'TRANSFER') {
        return <span className="text-xs">{from} ➞ {to}</span>;
    }
    if (type === 'IN') {
        return <span className="text-xs">{to}</span>;
    }
    if (type === 'OUT') {
        return <span className="text-xs">{from}</span>;
    }
    if (type === 'ADJUSTMENT') {
        const location = to !== 'N/A' ? to : from;
        return <span className="text-xs">{location}</span>;
    }
    return <span className="text-xs text-muted-foreground">N/A</span>;
};


export const columns = (options: ColumnsOptions): ColumnDef<StockMovement>[] => {
  const { locationMap } = options;

  return [
    {
        accessorKey: "timestamp",
        header: "Data e Hora",
        cell: ({ row }) => {
            const timestamp = row.original.timestamp as Timestamp;
            if (!timestamp) return 'N/A';
            const date = timestamp.toDate();
            return format(date, "dd/MM/yyyy HH:mm:ss");
        }
    },
    {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => <MovementTypeCell type={row.original.type} />
    },
    {
        accessorKey: "productName",
        header: "Produto",
    },
    {
        accessorKey: "quantity",
        header: "Quantidade",
        cell: ({ row }) => <QuantityCell quantity={row.original.quantity} type={row.original.type} />
    },
    {
        id: "location",
        header: "Localização",
        cell: ({ row }) => <LocationCell movement={row.original} locationMap={locationMap} />
    },
     {
        accessorKey: "reason",
        header: "Motivo",
        cell: ({ row }) => {
            const movement = row.original;
            if (movement.isAudit) {
                return (
                    <div className="text-xs">
                        <p className="font-semibold">{movement.reason}</p>
                        <p className="text-muted-foreground">
                            Ajuste de {movement.systemCountBefore} para {movement.physicalCount} ({movement.quantity > 0 ? '+' : ''}{movement.quantity})
                        </p>
                    </div>
                )
            }
            return <span className="text-xs">{movement.reason}</span>;
        }
    },
    {
        accessorKey: "userName",
        header: "Utilizador",
    },
  ];
};
