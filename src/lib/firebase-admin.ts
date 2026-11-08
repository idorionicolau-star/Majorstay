import * as admin from 'firebase-admin';
import { isSuperAdminEmail } from '@/lib/super-admin';

function getCredential() {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        try {
            const parsed = JSON.parse(serviceAccountKey);
            return admin.credential.cert(parsed);
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
        }
    }
    // Fallback for environments with GOOGLE_APPLICATION_CREDENTIALS set
    return admin.credential.applicationDefault();
}

export function initializeAdmin() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: getCredential(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }
    return admin;
}

export async function verifyIdToken(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const adminApp = initializeAdmin();
        const decodedToken = await adminApp.auth().verifyIdToken(token);

        // Fetch companyId and superAdmin status from the users collection
        const userDoc = await adminApp.firestore().doc(`users/${decodedToken.uid}`).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            let superAdmin = userData?.superAdmin === true;
            // Os emails de super-administrador (lib/super-admin.ts), com o email verificado (ex.: entrada com Google),
            // ganham a marca no Firestore sozinhos — as regras do Firestore também a exigem. Antes era preciso pô-la à mão.
            if (!superAdmin && decodedToken.email_verified && isSuperAdminEmail(decodedToken.email)) {
                superAdmin = true;
                await userDoc.ref.set({ superAdmin: true }, { merge: true }).catch((e) => console.error('superAdmin flag', e));
            }
            return {
                ...decodedToken,
                companyId: userData?.companyId || null,
                superAdmin,
            };
        }

        return decodedToken;
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return null;
    }
}
