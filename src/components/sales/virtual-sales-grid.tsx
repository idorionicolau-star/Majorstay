import { Sale } from '@/lib/types';
import { SaleCard } from './sale-card';
import { cn } from '@/lib/utils';
import { VirtuosoGrid } from 'react-virtuoso';
import { forwardRef } from 'react';

interface SalesGridProps {
    sales: Sale[];
    onUpdateSale: (sale: Sale) => void;
    onConfirmPickup: (sale: Sale) => void;
    onDeleteSale: (saleId: string) => void;
    canEdit: boolean;
    locations: Array<{ id: string, name: string }>;
    gridCols: '3' | '4' | '5';
}

// Criados uma vez por número de colunas (a cada render desmontavam os cartões e fechavam os painéis abertos).
const salesGrids = new Map<string, { List: React.ComponentType<any>; Item: React.ComponentType<any> }>();
function salesGrid(gridCols: string) {
    let g = salesGrids.get(gridCols);
    if (!g) {
        g = {
            List: forwardRef<HTMLDivElement, any>(function SalesGridList(props, ref) { return (
                <div
                    {...props}
                    ref={ref}
                    className={cn(
                        "grid gap-2 sm:gap-4 pb-20",
                        gridCols === '3' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                        gridCols === '4' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
                        gridCols === '5' && "grid-cols-1 sm:grid-cols-3 lg:grid-cols-5"
                    )}
                />
            ); }),
            Item: forwardRef<HTMLDivElement, any>(function SalesGridItem(props, ref) { return <div {...props} ref={ref} className="h-full" />; }),
        };
        salesGrids.set(gridCols, g);
    }
    return g;
}

export function VirtualSalesGrid({ // Keeping name to avoid breaking import immediately, but behavior is now standard
    sales,
    onUpdateSale,
    onConfirmPickup,
    onDeleteSale,
    canEdit,
    locations,
    gridCols,
}: SalesGridProps) {

    return (
        <VirtuosoGrid
            useWindowScroll
            increaseViewportBy={500}
            data={sales}
            totalCount={sales.length}
            components={salesGrid(gridCols)}
            itemContent={(index, sale) => (
                <SaleCard
                    key={sale.id}
                    sale={sale}
                    onUpdateSale={onUpdateSale}
                    onConfirmPickup={onConfirmPickup}
                    onDeleteSale={onDeleteSale}
                    viewMode={gridCols === '5' || gridCols === '4' ? 'condensed' : 'normal'}
                    canEdit={canEdit}
                    locationName={locations.find(l => l.id === sale.location)?.name}
                />
            )}
        />
    );
}
