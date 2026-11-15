export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { dishAvailable, dishDayKey } from '@/lib/dishes';

/**
 * Pratos do dia (companies/{c}/dishes).
 * POST { companyId, action: 'list' }
 * POST { companyId, action: 'save', id?, name, price }
 * POST { companyId, action: 'setQty', id, qty }      (0 = esgotado)
 * POST { companyId, action: 'delete', id }
 * Ver = quem tem Quartos (leitura); alterar = Admin ou Quartos (escrita).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, action } = body;
    const decoded = (await verifyIdToken(req)) as { uid: string; superAdmin?: boolean; companyId?: string } | null;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId || typeof companyId !== 'string') return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });

    const db = initializeAdmin().firestore();
    let canView = decoded.superAdmin === true;
    let canEdit = canView;
    if (!canView) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      const d = emp.exists ? emp.data() || {} : {};
      const perm = d.permissions?.rooms;
      canEdit = d.role === 'Admin' || perm === 'write';
      canView = canEdit || d.role === 'Dono' || perm === 'read';
    }
    if (!canView) return NextResponse.json({ error: 'Sem permissão para ver os pratos.' }, { status: 403 });

    const col = db.collection(`companies/${companyId}/dishes`);

    if (action === 'list') {
      const snap = await col.limit(200).get();
      const now = new Date();
      const dishes = snap.docs
        .map((s) => ({ id: s.id, ...(s.data() as any) }))
        .filter((d) => !d.deletedAt)
        .map((d) => ({ id: d.id, name: String(d.name || ''), price: Number(d.price) || 0, available: dishAvailable(d, now) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
      return NextResponse.json({ dishes });
    }

    if (!canEdit) return NextResponse.json({ error: 'Sem permissão para alterar os pratos.' }, { status: 403 });

    if (action === 'save') {
      const name = String(body.name ?? '').trim().slice(0, 80);
      const price = Math.round((Number(body.price) || 0) * 100) / 100;
      if (name.length < 2) return NextResponse.json({ error: 'Indique o nome do prato.' }, { status: 400 });
      if (!(price > 0) || price > 1e7) return NextResponse.json({ error: 'Indique um preço válido.' }, { status: 400 });
      if (body.id) {
        const ref = col.doc(String(body.id));
        if (!(await ref.get()).exists) return NextResponse.json({ error: 'Prato não encontrado.' }, { status: 404 });
        await ref.update({ name, price, updatedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, id: ref.id });
      }
      const ref = col.doc();
      await ref.set({ name, price, active: true, available: 0, availableDay: dishDayKey(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true, id: ref.id });
    }

    if (action === 'setQty') {
      const qty = Math.floor(Number(body.qty));
      if (!Number.isFinite(qty) || qty < 0 || qty > 999) return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
      const ref = col.doc(String(body.id || ''));
      if (!(await ref.get()).exists) return NextResponse.json({ error: 'Prato não encontrado.' }, { status: 404 });
      await ref.update({ available: qty, availableDay: dishDayKey(), updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const ref = col.doc(String(body.id || ''));
      if (!(await ref.get()).exists) return NextResponse.json({ error: 'Prato não encontrado.' }, { status: 404 });
      await ref.update({ deletedAt: new Date().toISOString(), available: 0 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    console.error('Erro nos pratos:', err);
    return NextResponse.json({ error: 'Não foi possível processar os pratos.' }, { status: 500 });
  }
}
