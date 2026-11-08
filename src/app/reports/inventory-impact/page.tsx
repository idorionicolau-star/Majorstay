import { redirect } from "next/navigation";

// "Impacto de Auditoria" repetia o que as Perdas já mostram (faltas e sobras das contagens, em dinheiro); o stock
// parado está no Diagnóstico. Os números ficam num só sítio.
export default function InventoryImpactPage() {
    redirect("/inventory/perdas");
}
