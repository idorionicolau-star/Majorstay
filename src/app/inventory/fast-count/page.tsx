import { redirect } from "next/navigation";

// A contagem faz-se no Stock Rápido (modo Contagem): toda a entrada e acerto de stock num só sítio.
export default function FastCountPage() {
    redirect("/inventory/quick?modo=contagem");
}
