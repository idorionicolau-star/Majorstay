export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { removeEmployee } from '@/lib/employee-admin';

/**
 * Apagar TODOS os dados da empresa e recomeçar do zero.
 *
 * Corre no servidor porque as regras do Firestore não deixam a app apagar movimentos de stock,
 * notificações, revisões de preço nem as correcções de vendas, e porque a lixeira da app só
 * marca como apagado (`deletedAt`) — os registos continuavam na base de dados.
 *
 * Body: { companyId, mode: 'preview' | 'backup' | 'delete', step?, includeEmployees }
 *  - preview: conta o que existe em cada coleção
 *  - backup:  devolve tudo o que vai ser apagado (a app descarrega o ficheiro)
 *  - delete:  apaga UMA coleção por chamada (`step`), com tudo o que está dentro dela
 *
 * Mantém sempre: a empresa (nome, plano, subscrição, pagamentos) e quem está a fazer o pedido.
 * Funcionários só saem se `includeEmployees` — e nesse caso também saem as contas de acesso.
 */
const DATA = [
    'sales', 'stockMovements', 'productions', 'orders', 'expenses', 'notifications', 'priceReviews',
    'products', 'customers', 'catalogProducts', 'catalogCategories', 'rawMaterials', 'recipes', 'reports',
] as const;
const LABELS: Record<string, string> = {
    sales: 'Vendas', stockMovements: 'Movimentos de stock', productions: 'Produção', orders: 'Encomendas',
    expenses: 'Despesas', notifications: 'Notificações', priceReviews: 'Revisões de preço', products: 'Produtos',
    customers: 'Clientes', catalogProducts: 'Catálogo', catalogCategories: 'Categorias', rawMaterials: 'Matéria-prima',
    recipes: 'Receitas', reports: 'Relatórios', employees: 'Funcionários',
};

export async function POST(req: Request) {
    const decoded = await verifyIdToken(req) as any;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 });

    const { companyId, mode, step, includeEmployees } = await req.json().catch(() => ({}));
    if (!companyId || !['preview', 'backup', 'delete'].includes(mode)) {
        return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
    }
    if (!decoded.superAdmin && companyId !== decoded.companyId) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const admin = initializeAdmin();
    const db = admin.firestore();
    const companyRef = db.doc(`companies/${companyId}`);

    const [me, company] = await Promise.all([db.doc(`companies/${companyId}/employees/${decoded.uid}`).get(), companyRef.get()]);
    if (!company.exists) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    if (!decoded.superAdmin && !['Admin', 'Dono'].includes(me.get('role'))) {
        return NextResponse.json({ error: 'Só o Dono ou o Administrador pode fazer isto.' }, { status: 403 });
    }

    const steps: string[] = [...DATA, ...(includeEmployees ? ['employees'] : [])];
    // funcionários a apagar: todos menos quem faz o pedido e o fundador da empresa
    const keepIds = new Set<string>([decoded.uid, company.get('ownerId')].filter(Boolean));
    const employeesToRemove = async (withData = false) => {
        const ref = db.collection(`companies/${companyId}/employees`);
        const snap = withData ? await ref.get() : await ref.select().get();
        return snap.docs.filter((d) => !keepIds.has(d.id));
    };

    if (mode === 'preview') {
        const counts = [];
        for (const name of steps) {
            if (name === 'employees') {
                counts.push({ id: name, label: LABELS[name], count: (await employeesToRemove()).length });
                continue;
            }
            const agg = await db.collection(`companies/${companyId}/${name}`).count().get();
            counts.push({ id: name, label: LABELS[name], count: agg.data().count });
        }
        return NextResponse.json({ counts, steps });
    }

    if (mode === 'backup') {
        const data: Record<string, unknown[]> = {};
        for (const name of steps) {
            if (name === 'employees') {
                data[name] = (await employeesToRemove(true)).map((d) => ({ id: d.id, ...d.data() }));
                continue;
            }
            const snap = await db.collection(`companies/${companyId}/${name}`).get();
            data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        return NextResponse.json({ backup: { company: companyId, exportedAt: new Date().toISOString(), data } });
    }

    // mode === 'delete' — uma coleção por chamada, para não passar o tempo limite do servidor
    if (!step || !steps.includes(step)) {
        return NextResponse.json({ error: 'Passo inválido.' }, { status: 400 });
    }

    let deleted = 0;
    if (step === 'employees') {
        const docs = await employeesToRemove();
        for (const d of docs) {
            await removeEmployee(db, admin, companyId, d.id);
            deleted++;
        }
    } else {
        const ref = db.collection(`companies/${companyId}/${step}`);
        deleted = (await ref.count().get()).data().count;
        // apaga também as subcoleções (ex.: correcções guardadas por baixo de cada venda)
        await db.recursiveDelete(ref);
    }

    // última coleção: volta a zero a numeração e limpa a marca do arranque oficial
    if (step === steps[steps.length - 1]) {
        // a numeração com prefixo (FT-0001…) também recomeça
        const numbering = (company.get('documentNumbering') || {}) as Record<string, unknown>;
        const numberingReset = Object.fromEntries(Object.keys(numbering).map((k) => [`documentNumbering.${k}.nextNumber`, 1]));
        await companyRef.update({
            ...numberingReset,
            saleCounter: 0,
            dataResetAt: admin.firestore.FieldValue.delete(),
            dataResetBy: admin.firestore.FieldValue.delete(),
            dataResetCutoff: admin.firestore.FieldValue.delete(),
            fullResetAt: new Date().toISOString(),
            fullResetBy: decoded.uid,
        });
    }
    return NextResponse.json({ deleted, step });
}
