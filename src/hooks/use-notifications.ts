'use client';

import { useCallback, useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore, useMessaging } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';

export type PushStatus = 'unsupported' | 'no-key' | 'default' | 'denied' | 'enabled' | 'error';

const VAPID = process.env.NEXT_PUBLIC_VAPID_KEY;
/** Código deste aparelho: serve para não o avisar das vendas que ele próprio fez (e avisar os outros, mesmo da mesma conta). */
export const PUSH_TOKEN_KEY = 'majorstockx-push-token';

/**
 * Push notifications for this device.
 * - Never asks for permission on its own: Chrome on Android silently blocks prompts that don't
 *   come from a tap. `enable()` must be called from a button.
 * - Once allowed, the device token is saved in companies/{companyId}/pushTokens/{token} so the
 *   server (/api/push) knows where to send alerts. (Before, the token was obtained and thrown away.)
 */
export function usePushNotifications(companyId: string | null | undefined, user: { id: string; username: string } | null | undefined, opts: { listen?: boolean } = {}) {
    const listen = !!opts.listen;
    const messaging = useMessaging();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [status, setStatus] = useState<PushStatus>('default');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = useCallback(async (): Promise<boolean> => {
        if (!messaging || !companyId || !user || !VAPID) return false;
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const token = await getToken(messaging, { vapidKey: VAPID, serviceWorkerRegistration: swReg });
        if (!token) return false;
        try { localStorage.setItem(PUSH_TOKEN_KEY, token); } catch { /* ignore */ }
        await setDoc(doc(firestore, `companies/${companyId}/pushTokens/${token}`), {
            userId: user.id,
            userName: user.username,
            userAgent: navigator.userAgent.slice(0, 200),
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return true;
    }, [messaging, companyId, user, firestore]);

    // Work out the current state; if already allowed, refresh the token silently.
    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
            setStatus('unsupported');
            return;
        }
        if (!VAPID) { setStatus('no-key'); return; }
        if (Notification.permission === 'denied') { setStatus('denied'); return; }
        if (Notification.permission !== 'granted') { setStatus('default'); return; }
        if (!messaging || !companyId || !user) return;
        register().then((ok) => { setStatus(ok ? 'enabled' : 'error'); if (!ok) setError('Não foi possível obter o código do aparelho.'); }).catch((e) => {
            console.warn('[Push] Falha ao renovar o token:', e);
            setError(String(e?.code || e?.message || e).slice(0, 160));
            setStatus('error');
        });
    }, [messaging, companyId, user, register]);

    // App open: show the message as a toast (the system notification only shows in background).
    useEffect(() => {
        if (!messaging || !listen) return; // only one instance (the layout banner) shows foreground toasts
        return onMessage(messaging, (payload) => {
            const d = payload.data || {};
            toast({ title: d.title || payload.notification?.title || 'Nova notificação', description: d.body || payload.notification?.body || '' });
        });
    }, [messaging, toast, listen]);

    const enable = useCallback(async () => {
        if (status === 'unsupported' || status === 'no-key') return;
        setBusy(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus(permission === 'denied' ? 'denied' : 'default');
                return;
            }
            const ok = await register();
            setStatus(ok ? 'enabled' : 'error');
            if (ok) toast({ title: 'Notificações activadas', description: 'Este aparelho vai receber alertas de vendas e stock.' });
        } catch (e) {
            console.warn('[Push] Erro ao activar:', e);
            setError(String((e as any)?.code || (e as any)?.message || e).slice(0, 160));
            setStatus('error');
        } finally {
            setBusy(false);
        }
    }, [status, register, toast]);

    return { status, enable, busy, error };
}
