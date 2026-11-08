export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { removeEmployee } from '@/lib/employee-admin';
import { companyMaxUsers, tierById } from '@/lib/tiers';

/**
 * Gestão de funcionários no servidor.
 *
 * Corre aqui (Admin SDK) porque as regras do Firestore não deixam um Admin criar o
 * mapa `users/{uid}` de outra pessoa, nem apagá-lo, nem mudar a função de um funcionário,
 * e porque só o servidor pode apagar a conta de autenticação.
 *
 * POST   { companyId, username, email, password, role, permissions }  → cria conta + funcionário
 * PATCH  { companyId, employeeId, username, role, permissions, site? } → actualiza (site: ponto onde trabalha)
 * DELETE { companyId, employeeId }                                    → remove funcionário + conta
 */
const ROLES = ['Admin', 'Employee', 'Dono'];

async function authorize(req: Request, companyId: unknown) {
    const decoded = await verifyIdToken(req) as any;
    if (!decoded) return { error: NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 }) };
    if (!companyId || typeof companyId !== 'string') {
        return { error: NextResponse.json({ error: 'Dados em falta.' }, { status: 400 }) };
    }
    if (!decoded.superAdmin && companyId !== decoded.companyId) {
        return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
    }
    const db = initializeAdmin().firestore();
    if (!decoded.superAdmin) {
        const me = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
        if (!['Admin', 'Dono'].includes(me.get('role'))) {
            return { error: NextResponse.json({ error: 'Só o Dono ou o Administrador pode gerir funcionários.' }, { status: 403 }) };
        }
    }
    return { decoded, db, admin: initializeAdmin() };
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const a = await authorize(req, body.companyId);
    if ('error' in a) return a.error;
    const { db, admin } = a;
    const { companyId, username, email, password, role, permissions } = body;

    if (!username || !email || !password || !ROLES.includes(role)) {
        return NextResponse.json({ error: 'Dados em falta ou inválidos.' }, { status: 400 });
    }
    if (String(password).length < 6) {
        return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }
    // utilizadores incluídos no plano (o Dono conta como um)
    const company = (await db.doc(`companies/${companyId}`).get()).data();
    const max = companyMaxUsers(company);
    if (max != null && !a.decoded.superAdmin) {
        const count = (await db.collection(`companies/${companyId}/employees`).count().get()).data().count;
        if (count >= max) {
            const label = tierById(company?.tier)?.label || '';
            return NextResponse.json({ error: `O plano ${label} inclui ${max === 1 ? '1 utilizador' : `${max} utilizadores`}. Mude de plano (Subscrição) para juntar mais.`, code: 'plan-limit' }, { status: 403 });
        }
    }

    let uid: string | null = null;
    try {
        const user = await admin.auth().createUser({ email, password, displayName: username });
        uid = user.uid;
        const batch = db.batch();
        batch.set(db.doc(`companies/${companyId}/employees/${uid}`), {
            username, email, role, companyId, permissions: permissions || {},
        });
        batch.set(db.doc(`users/${uid}`), { companyId });
        await batch.commit();
        return NextResponse.json({ id: uid, email });
    } catch (e: any) {
        // não deixa uma conta de autenticação órfã se o resto falhou
        if (uid) await admin.auth().deleteUser(uid).catch(() => { });
        if (e?.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'Este email já está a ser utilizado.', code: 'email-exists' }, { status: 409 });
        }
        if (e?.code === 'auth/invalid-password') {
            return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
        }
        if (e?.code === 'auth/invalid-email') {
            return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
        }
        console.error('Create employee error:', e);
        return NextResponse.json({ error: 'Não foi possível criar o funcionário.' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const body = await req.json().catch(() => ({}));
    const a = await authorize(req, body.companyId);
    if ('error' in a) return a.error;
    const { decoded, db } = a;
    const { companyId, employeeId, username, role, permissions, site } = body;

    if (!employeeId || !ROLES.includes(role)) {
        return NextResponse.json({ error: 'Dados em falta ou inválidos.' }, { status: 400 });
    }
    const ref = db.doc(`companies/${companyId}/employees/${employeeId}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (employeeId === decoded.uid && role !== snap.get('role')) {
        return NextResponse.json({ error: 'Não pode alterar a sua própria função.' }, { status: 400 });
    }
    if (snap.get('role') === 'Admin' && role !== 'Admin') {
        const admins = await db.collection(`companies/${companyId}/employees`).where('role', '==', 'Admin').get();
        if (admins.size <= 1) {
            return NextResponse.json({ error: 'A empresa tem de ter pelo menos um Administrador.' }, { status: 400 });
        }
    }
    await ref.update({
        ...(username ? { username } : {}), role, permissions: permissions || {},
        // ponto onde trabalha (só funcionários; vazio = vê tudo)
        ...(typeof site === 'string' ? { site: role === 'Employee' ? site.trim().slice(0, 60) : '' } : {}),
    });
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
    const body = await req.json().catch(() => ({}));
    const a = await authorize(req, body.companyId);
    if ('error' in a) return a.error;
    const { decoded, db, admin } = a;
    const { companyId, employeeId } = body;

    if (!employeeId) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
    if (employeeId === decoded.uid) {
        return NextResponse.json({ error: 'Não pode remover a sua própria conta.' }, { status: 400 });
    }
    const company = await db.doc(`companies/${companyId}`).get();
    if (company.get('ownerId') === employeeId) {
        return NextResponse.json({ error: 'O fundador da empresa não pode ser removido.' }, { status: 400 });
    }

    await removeEmployee(db, admin, companyId, employeeId);
    return NextResponse.json({ ok: true });
}
