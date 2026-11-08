import { redirect } from "next/navigation";

// A folha de cálculo de entrada vive agora dentro do Stock Rápido (toda a entrada de stock num só sítio).
export default function FastEntryPage() {
    redirect("/inventory/quick?vista=folha");
}
