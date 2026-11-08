/** Apaga o funcionário, o mapa `users/{uid}`, os seus aparelhos push e a conta de autenticação. */
export async function removeEmployee(db: FirebaseFirestore.Firestore, admin: typeof import('firebase-admin'), companyId: string, employeeId: string) {
    const tokens = await db.collection(`companies/${companyId}/pushTokens`).where('userId', '==', employeeId).get();
    const batch = db.batch();
    tokens.docs.forEach((t) => batch.delete(t.ref));
    batch.delete(db.doc(`companies/${companyId}/employees/${employeeId}`));
    // só apaga o mapa se ainda apontar para esta empresa
    const map = await db.doc(`users/${employeeId}`).get();
    if (map.exists && map.get('companyId') === companyId && !map.get('superAdmin')) batch.delete(map.ref);
    await batch.commit();
    await admin.auth().deleteUser(employeeId).catch((e: any) => {
        if (e?.code !== 'auth/user-not-found') console.error('Delete auth user error:', e);
    });
}
