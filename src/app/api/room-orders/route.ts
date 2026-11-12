export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * Pedidos de bar feitos pelos hóspedes (roomOrders).
 * GET  ?companyId=…                       → pedidos pendentes (precisa de permissão de leitura em Quartos)
 * POST { companyId, orderId, action:'reject', reason } → recusa um pedido pendente (permissão de escrita em Quartos)
 * A confirmação (lançar na conta da estadia) faz-se em /api/stays/consumption com `orderId`, de forma atómica.
 */
type AuthOk = { decoded: { uid: string }; employeeName: string; db: FirebaseFirestore.Firestore };

async function authorize(req: Request, companyId: string, level: 'read' | 'write'): Promise<{ error: NextResponse } | AuthOk> {
  const decoded = (await verifyIdToken(req)) as { uid: string; email?: string; name?: string; superAdmin?: boolean; companyId?: string } | null;
  if (!decoded) return { error: NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 }) };
  if (!companyId) return { error: NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 }) };
  if (!decoded.superAdmin && companyId !== decoded.companyId) {
    return { error: NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 }) };
  }
  const db = initializeAdmin().firestore();
  let employeeName = decoded.name || decoded.email || 'Funcionário';
  let allowed = decoded.superAdmin === true;
  if (!allowed) {
    const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (emp.exists) {
      const d = emp.data() || {};
      employeeName = (d.username as string) || employeeName;
      const role = d.role as string;
      const perm = d.permissions?.rooms;
      allowed =
        role === 'Admin' ||
        (role === 'Dono' && level === 'read') ||
        perm === 'write' ||
        (level === 'read' && perm === 'read');
    }
  }
  if (!allowed) return { error: NextResponse.json({ error: 'Sem permissão para gerir pedidos dos quartos.' }, { status: 403 }) };
  return { decoded, employeeName, db };
}

export async function GET(req: Request) {
  try {
    const companyId = new URL(req.url).searchParams.get('companyId') || '';
    const auth = await authorize(req, companyId, 'read');
    if ('error' in auth) return auth.error;

    const snap = await auth.db
      .collection(`companies/${companyId}/roomOrders`)
      .where('status', '==', 'pending')
      .limit(50)
      .get();
    const orders = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .sort((a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return NextResponse.json({ orders });
  } catch (err) {
    console.error('Erro em GET /api/room-orders:', err);
    return NextResponse.json({ error: 'Erro ao carregar os pedidos.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (body.action !== 'reject' || !orderId) {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    const auth = await authorize(req, companyId, 'write');
    if ('error' in auth) return auth.error;

    const ref = auth.db.doc(`companies/${companyId}/roomOrders/${orderId}`);
    const result = await auth.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 404, error: 'Pedido não encontrado.' };
      if (snap.data()?.status !== 'pending') return { status: 409, error: 'Este pedido já foi tratado.' };
      tx.update(ref, {
        status: 'rejected',
        rejectReason: reason,
        resolvedAt: new Date().toISOString(),
        resolvedBy: auth.decoded.uid,
        resolvedByName: auth.employeeName,
      });
      return { status: 200 };
    });
    if (result.status !== 200) {
      return NextResponse.json({ error: (result as any).error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro em POST /api/room-orders:', err);
    return NextResponse.json({ error: 'Erro ao recusar o pedido.' }, { status: 500 });
  }
}
