import { VirtuosoGrid } from 'react-virtuoso';
import { Product, Location } from '@/lib/types';
import { ProductCard } from './product-card';
import { cn } from '@/lib/utils';
import { forwardRef, useMemo } from 'react';

interface VirtualProductGridProps {
    products: Product[];
    onProductUpdate: (product: Product) => void;
    onAttemptDelete: (product: Product) => void;
    canEdit: boolean;
    locations: Location[];
    isMultiLocation: boolean;
    gridCols: '3' | '4' | '5';
    loadMore: () => void;
    hasMore: boolean;
    loading: boolean;
}

const GridContainer = forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className={cn(className, "w-full")}
    />
));
GridContainer.displayName = 'GridContainer';

const GridList = forwardRef<HTMLDivElement, any>(({ className, children, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className={cn("flex flex-wrap gap-2 sm:gap-4 pb-4", className)}
    >
        {children}
    </div>
));
GridList.displayName = 'GridList';

export function VirtualProductGrid({
    products,
    onProductUpdate,
    onAttemptDelete,
    canEdit,
    locations,
    isMultiLocation,
    gridCols,
    loadMore,
    hasMore,
    loading
}: VirtualProductGridProps) {

    const ItemContainer = useMemo(() => {
        return function ItemContainer({ children, ...props }: any) {
            let widthClass = "w-full"; // Fallback

            // Calculate width based on columns and gap
            // Mobile: w-full (1 column)
            // Small/Medium and up: grid cols logic
            if (gridCols === '3') widthClass = "w-full md:w-[calc(33.333%-0.8rem)]";
            else if (gridCols === '4') widthClass = "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(25%-0.8rem)]";
            else if (gridCols === '5') widthClass = "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(25%-0.8rem)] lg:w-[calc(20%-0.85rem)]";

            return (
                <div {...props} className={cn(widthClass, "mb-2")}>
                    {children}
                </div>
            );
        };
    }, [gridCols]);

    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            // useWindowScroll removed to fix pagination in scrollable container
            data={products}
            endReached={() => {
                if (hasMore && !loading) {
                    loadMore();
                }
            }}
            overscan={200}
            components={{
                List: GridList,
                Item: ItemContainer,
                Footer: () => loading ? <div className="py-4 text-center text-sm text-muted-foreground">A carregar mais produtos...</div> : null
            }}
            itemContent={(index: number, product: Product) => (
                <div style={{ height: '100%' }}>
                    <ProductCard
                        key={product.id || product.instanceId || product.name}
                        product={product}
                        onProductUpdate={onProductUpdate}
                        onAttemptDelete={onAttemptDelete}
                        viewMode={gridCols === '5' || gridCols === '4' ? 'condensed' : 'normal'}
                        canEdit={canEdit}
                        locations={locations}
                        isMultiLocation={isMultiLocation}
                    />
                </div>
            )}
        />
    );
}
