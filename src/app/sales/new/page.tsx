import { redirect } from "next/navigation";

// Havia aqui um segundo formulário de venda (um produto de cada vez). Tudo o que ele fazia — outra data, documento,
// desconto (também em %), IVA, cliente — está na Venda Rápida: vender tem uma só porta.
export default function NewSalePage() {
    redirect("/pos");
}
