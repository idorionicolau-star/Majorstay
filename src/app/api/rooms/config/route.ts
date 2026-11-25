export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { companyMaxRooms } from '@/lib/tiers';
import { diffRoomConfig, sanitizeRoomConfig } from '@/lib/room-config';
import { subscriptionBlocked } from '@/lib/stay-checkin';

/**
 * Criar e editar quartos (preços, mínimo de horas, pacotes...). SÓ o administrador, e só aqui:
 * as regras da base de dados já não deixam ninguém gravar estes campos diretamente.
 * Cada mudança fica no registo (hospitalityAudit): quem, quando, valor antigo e novo.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, action, roomId } = body;

    const decoded = (await verifyIdToken(req)) as any;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId || typeof companyId !== 'string') return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });
    if (action !== 'create' && action !== 'update') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

    const admin = initializeAdmin();
    const db = admin.firestore();

    let userName = decoded.name || decoded.email || 'Administrador';
    let isAdmin = decoded.superAdmin === true;
    if (!isAdmin) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      if (emp.exists) {
        const d = emp.data() || {};
        userName = d.username || userName;
        isAdmin = d.role === 'Admin';
      }
    }
    if (!isAdmin) {
      return NextResponse.json({ error: 'Só o administrador pode criar ou alterar quartos e os seus preços.' }, { status: 403 });
    }

    let patch;
    try {
      patch = sanitizeRoomConfig(body.data && typeof body.data === 'object' ? body.data : {});
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const companyRef = db.doc(`companies/${companyId}`);
    const ts = admin.firestore.FieldValue.serverTimestamp();

    const result = await db.runTransaction(async (tx) => {
      const companySnap = await tx.get(companyRef);
      const company = (companySnap.exists ? companySnap.data() : {}) || {};
      if (!decoded.superAdmin && subscriptionBlocked(company, Date.now())) {
        throw Object.assign(new Error('A subscrição deste alojamento não está ativa.'), { http: 403 });
      }
      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();

      if (action === 'create') {
        if (!patch.name) throw Object.assign(new Error('O nome do quarto é obrigatório.'), { http: 400 });
        const max = companyMaxRooms(company as any);
        if (max !== null) {
          const active = await tx.get(db.collection(`companies/${companyId}/rooms`));
          const count = active.docs.filter((d) => d.data()?.active !== false).length;
          if (count >= max) {
            throw Object.assign(new Error(`Limite de quartos atingido (${max} no plano atual). Faça upgrade para adicionar mais.`), { http: 409 });
          }
        }
        const ref = db.collection(`companies/${companyId}/rooms`).doc();
        tx.set(ref, {
          ratePerHour: 0, minimumHours: 1,
          ...patch,
          status: 'free',
          active: patch.active !== false,
          createdAt: ts,
          updatedAt: ts,
        });
        const { images: imgs, ...createdFields } = patch;
        tx.set(auditRef, {
          action: 'create_room', targetId: ref.id, targetType: 'room',
          before: {}, after: { ...createdFields, imagesCount: Array.isArray(imgs) ? imgs.length : 0 },
          reason: 'Quarto criado', userId: decoded.uid, userName, timestamp: ts, companyId,
        });
        return { roomId: ref.id };
      }

      if (!roomId || typeof roomId !== 'string') throw Object.assign(new Error('Quarto em falta.'), { http: 400 });
      const roomRef = db.doc(`companies/${companyId}/rooms/${roomId}`);
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists) throw Object.assign(new Error('Quarto não encontrado.'), { http: 404 });
      const before = roomSnap.data() || {};
      const diff = diffRoomConfig(before, patch);
      tx.update(roomRef, { ...patch, updatedAt: ts });
      if (diff) {
        tx.set(auditRef, {
          action: 'update_room', targetId: roomId, targetType: 'room',
          before: { roomName: before.name ?? null, ...diff.before }, after: diff.after,
          reason: 'Quarto alterado pelo administrador', userId: decoded.uid, userName, timestamp: ts, companyId,
        });
      }
      return { roomId };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    if (e?.http) return NextResponse.json({ error: e.message }, { status: e.http });
    console.error('[rooms/config]', e);
    return NextResponse.json({ error: 'Não foi possível guardar o quarto. Tente de novo.' }, { status: 500 });
  }
}

/** Últimas alterações de quartos e preços (quem, quando, antes → depois). Só administrador ou dono. */
export async function GET(req: Request) {
  try {
    const companyId = new URL(req.url).searchParams.get('companyId') || '';
    const decoded = (await verifyIdToken(req)) as any;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId) return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });

    const db = initializeAdmin().firestore();
    let allowed = decoded.superAdmin === true;
    if (!allowed) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      allowed = emp.exists && ['Admin', 'Dono'].includes((emp.data() || {}).role);
    }
    if (!allowed) return NextResponse.json({ error: 'Só o administrador ou o dono pode ver estas alterações.' }, { status: 403 });

    const snap = await db.collection(`companies/${companyId}/hospitalityAudit`).orderBy('timestamp', 'desc').limit(200).get();
    const iso = (t: any) => (t && typeof t.toDate === 'function' ? t.toDate().toISOString() : typeof t === 'string' ? t : '');
    const changes = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }) as Record<string, any>)
      .filter((a) => a.action === 'update_room' || a.action === 'create_room')
      .slice(0, 40)
      .map((a) => ({
        id: a.id,
        action: a.action as string,
        roomName: String(a.before?.roomName ?? a.after?.name ?? 'Quarto'),
        by: String(a.userName || ''),
        at: iso(a.timestamp),
        before: a.before || {},
        after: a.after || {},
      }));
    return NextResponse.json({ changes });
  } catch (e) {
    console.error('[rooms/config GET]', e);
    return NextResponse.json({ error: 'Não foi possível carregar as alterações.' }, { status: 500 });
  }
}
