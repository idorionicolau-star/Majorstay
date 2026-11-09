"use client";

import { useContext } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { KPISkeleton } from "@/components/dashboard/kpi-skeleton";
import { PanelSkeleton } from "@/components/dashboard/panel-skeleton";
import { HospitalityDashboard } from "@/components/dashboard/hospitality-dashboard";

export default function DashboardPage() {
  const { loading } = useContext(InventoryContext) || { loading: true };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pb-10 main-content">
        <KPISkeleton />
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-10 main-content">
      <HospitalityDashboard />
    </div>
  );
}
