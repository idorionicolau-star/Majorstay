export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * Arranque oficial: apaga os registos criados antes de hoje (uma só vez por empresa).
 *
 * Corre no servidor porque as regras não deixam a app apagar movimentos de stock,
 * notificações nem revisões de preço — e assim continuam imutáveis para todos.
 * Usa a data em que cada documento foi criado na base de dados (createTime), não a
 * data escrita nele: uma venda atrasada lançada hoje fica.
 *
 * Body: { companyId, cutoff (ISO, início de hoje no aparelho), mode: 'preview' | 'backup' | 'delete', includeProducts }
 * Mantém sempre: clientes, catálogo, categorias, matéria-prima, receitas, funcionários e definições.
 */
const HISTORY = ['sales', 'stockMovements', 'productions', 'orders', 'expenses', 'notifications', 'priceReviews'] as const;
const LABELS: Record<string, string> = {
    sales: 'Vendas', stockMovements: 'Movimentos de stock', productions: 'Produção', orders: 'Encomendas',
    expenses: 'Despesas', notifications: 'Notificações', priceReviews: 'Revisões de preço', products: 'Produtos',
};
const PER_CALL = 2500; // apaga por partes para não passar o tempo limite do servidor

export async function POST(req: Request) {
    const decoded = await verifyIdToken(req) as any;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 });

    const { companyId, cutoff, mode, includeProducts } = await req.json().catch(() => ({}));
    if (!companyId || !cutoff || !['preview', 'backup', 'delete'].includes(mode)) {
        return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
    }
    if (!decoded.superAdmin && companyId !== decoded.companyId) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    // O corte tem de ser o início de hoje: nunca no futuro (apagaria o de hoje) nem há mais de 2 dias.
    const cut = new Date(cutoff);
    const now = Date.now();
    if (isNaN(cut.getTime()) || cut.getTime() > now || now - cut.getTime() > 48 * 3600_000) {
        return NextResponse.json({ error: 'Data de corte inválida. Confirme a data e a hora do aparelho.' }, { status: 400 });
    }

    const admin = initializeAdmin();
    const db = admin.firestore();
    const companyRef = db.doc(`companies/${companyId}`);

    const [employee, company] = await Promise.all([db.doc(`companies/${companyId}/employees/${decoded.uid}`).get(), companyRef.get()]);
    if (!decoded.superAdmin && !['Admin', 'Dono'].includes(employee.get('role'))) {
        return NextResponse.json({ error: 'Só o Dono ou o Administrador pode fazer isto.' }, { status: 403 });
    }
    const doneAt = company.get('dataResetAt');
    if (doneAt && !decoded.superAdmin) {
        return NextResponse.json({ error: `O arranque já foi feito em ${new Date(doneAt).toLocaleString('pt-PT')}.`, doneAt }, { status: 409 });
    }

    const cutMs = cut.getTime();
    const collections: string[] = [...HISTORY, ...(includeProducts ? ['products'] : [])];
    const old = async (name: string, withData = false) => {
        const ref = db.collection(`companies/${companyId}/${name}`);
        const snap = withData || name === 'products' ? await ref.get() : await ref.select().get();
        return snap.docs.filter((d) => d.createTime.toMillis() < cutMs);
    };

    if (mode === 'preview') {
        const counts: { id: string; label: string; count: number; examples?: string[] }[] = [];
        for (const name of collections) {
            const docs = await old(name);
            counts.push({
                id: name, label: LABELS[name], count: docs.length,
                ...(name === 'products' ? { examples: docs.slice(0, 8).map((d) => String(d.get('name') || '')) } : {}),
            });
        }
        let keptProducts: number | undefined;
        if (includeProducts) {
            const all = await db.collection(`companies/${companyId}/products`).select().get();
            keptProducts = all.size - (counts.find((c) => c.id === 'products')?.count || 0);
        }
        return NextResponse.json({ counts, keptProducts });
    }

    if (mode === 'backup') {
        const backup: Record<string, unknown[]> = {};
        for (const name of collections) {
            backup[name] = (await old(name, true)).map((d) => ({ id: d.id, createdAt: d.createTime.toDate().toISOString(), ...d.data() }));
        }
        return NextResponse.json({ backup: { company: companyId, cutoff: cut.toISOString(), exportedAt: new Date().toISOString(), data: backup } });
    }

    // mode === 'delete'
    const writer = db.bulkWriter();
    let budget = PER_CALL;
    const deleted: Record<string, number> = {};
    let more = false;
    for (const name of collections) {
        if (budget <= 0) { more = true; break; }
        const docs = await old(name);
        const batch = docs.slice(0, budget);
        if (docs.length > batch.length) more = true;
        for (const d of batch) {
            if (name === 'sales') {
                // correcções guardadas por baixo de cada venda
                const hist = await d.ref.collection('history').listDocuments();
                hist.forEach((h) => writer.delete(h));
            }
            writer.delete(d.ref);
        }
        deleted[name] = batch.length;
        budget -= batch.length;
    }
    await writer.close();

    let reservedFixed = 0;
    if (!more) {
        reservedFixed = await recalcReserved(db, companyId);
        await companyRef.set({ dataResetAt: new Date().toISOString(), dataResetBy: decoded.uid, dataResetCutoff: cut.toISOString() }, { merge: true });
    }
    return NextResponse.json({ deleted, more, reservedFixed });
}

/**
 * Stock reservado = vendas pagas ainda por levantar que ficaram (mesma regra que
 * Ajustes → "Recalcular stock reservado"). Sem as vendas antigas, as reservas delas saem.
 */
async function recalcReserved(db: FirebaseFirestore.Firestore, companyId: string) {
    const [salesSnap, productsSnap] = await Promise.all([
        db.collection(`companies/${companyId}/sales`).where('status', '==', 'Pago').get(),
        db.collection(`companies/${companyId}/products`).get(),
    ]);
    const reserved = new Map<string, number>();
    salesSnap.docs.forEach((d) => {
        const s = d.data();
        if (s.deletedAt || s.documentType === 'Factura Proforma') return;
        const key = `${s.productName}|${s.location || ''}`;
        reserved.set(key, (reserved.get(key) || 0) + (Number(s.quantity) || 0));
    });
    const writer = db.bulkWriter();
    const seen = new Set<string>();
    let fixed = 0;
    productsSnap.docs.forEach((d) => {
        const p = d.data();
        if (p.deletedAt) return;
        const key = `${p.name}|${p.location || ''}`;
        const correct = seen.has(key) ? 0 : (reserved.get(key) || 0);
        seen.add(key);
        if ((Number(p.reservedStock) || 0) !== correct) {
            writer.update(d.ref, { reservedStock: correct });
            fixed++;
        }
    });
    await writer.close();
    return fixed;
}
