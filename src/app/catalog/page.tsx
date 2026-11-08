"use client";

import { CatalogManager } from "@/components/settings/catalog-manager";
import { ProductsTabs } from "@/components/inventory/products-tabs";

export default function CatalogPage() {
    return (
        <div className="container mx-auto py-4 md:py-8">
            <ProductsTabs className="mb-4" />
            <CatalogManager />
        </div>
    );
}
