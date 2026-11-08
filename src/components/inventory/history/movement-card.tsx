
"use client";

import type { StockMovement, MovementType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Pencil, Calendar, Box, User, Tag, MapPin } from "lucide-react";
import { format } from 'date-fns';
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface MovementCardProps {
    movement: StockMovement;
    locationMap: Map<string, string>;
}

const movementConfig = {
    IN: { icon: ArrowDownLeft, color: "text-green-500", label: "Entrada" },
    OUT: { icon: ArrowUpRight, color: "text-red-500", label: "Saída" },
    TRANSFER: { icon: ArrowRightLeft, color: "text-blue-500", label: "Transferência" },
    ADJUSTMENT: { icon: Pencil, color: "text-yellow-500", label: "Ajuste" }
};

const DetailItem = ({ icon: Icon, value }: { icon: React.ElementType, value: React.ReactNode }) => (
    <div className="flex items-start gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-muted-foreground">{value}</div>
    </div>
);


export function MovementCard({ movement, locationMap }: MovementCardProps) {
    const { icon: Icon, color } = movementConfig[movement.type];
    const timestamp = movement.timestamp as Timestamp;
    const date = timestamp ? format(timestamp.toDate(), "dd/MM/yyyy HH:mm") : 'N/A';

    const fromLocation = movement.fromLocationId ? (locationMap.get(movement.fromLocationId) || movement.fromLocationId) : '';
    const toLocation = movement.toLocationId ? (locationMap.get(movement.toLocationId) || movement.toLocationId) : '';
    let locationText = '';
    if (movement.type === 'TRANSFER') {
        locationText = `${fromLocation} → ${toLocation}`;
    } else if (movement.type === 'IN') {
        locationText = toLocation;
    } else if (movement.type === 'OUT') {
        locationText = fromLocation;
    } else if (movement.type === 'ADJUSTMENT') {
        locationText = toLocation || fromLocation;
    }

    const isOut = movement.type === 'OUT' || (movement.type === 'ADJUSTMENT' && movement.quantity < 0);
    const quantityDisplay = movement.quantity > 0 && !isOut ? `+${movement.quantity}` : movement.quantity;
    const quantityColor = isOut ? "text-red-500" : "text-green-500";

    const reasonDisplay = movement.isAudit
        ? (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25">
                        Auditoria
                    </span>
                    <span className="font-medium text-foreground">{movement.reason}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-1">
                    Sistema: <span className="font-mono font-medium">{movement.systemCountBefore}</span>
                    {' '}→{' '}
                    Físico: <span className="font-mono font-medium">{movement.physicalCount}</span>
                    {' '}(Ajuste: {movement.quantity > 0 ? '+' : ''}{movement.quantity})
                </div>
            </div>
        )
        : movement.reason;


    return (
        <Card className="glass-card">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Icon className={cn("h-5 w-5", color)} />
                        {movement.productName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{date}</p>
                </div>
                <div className={cn("text-lg font-bold font-mono", quantityColor)}>
                    {quantityDisplay}
                </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs pt-2">
                <DetailItem icon={Tag} value={reasonDisplay} />
                {locationText && <DetailItem icon={MapPin} value={locationText} />}
                <DetailItem icon={User} value={movement.userName} />
            </CardContent>
        </Card>
    );
}
