// Service worker único da app: notificações push (Firebase Cloud Messaging) + modo offline.
// Só pode haver um service worker por âmbito, por isso as duas funções vivem aqui.
// A versão compat deve acompanhar a versão major do pacote "firebase" (package.json).
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyB4HFV5VZ9FU3vQ3bu04KV_sHhioECJqNo",
    authDomain: "atrevamoneytracker.firebaseapp.com",
    projectId: "atrevamoneytracker",
    storageBucket: "atrevamoneytracker.appspot.com",
    messagingSenderId: "882443102074",
    appId: "1:882443102074:web:17ba3de56b34350bd718c3"
});

const messaging = firebase.messaging();

// Mensagens "data-only" (o servidor envia assim para controlar ícone e link no Android).
messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const title = d.title || payload.notification?.title || 'MajorStockX';
    self.registration.showNotification(title, {
        body: d.body || payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        data: { link: d.link || '/dashboard' },
    });
});

// Tocar na notificação abre (ou foca) a app na página certa.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = (event.notification.data && event.notification.data.link) || '/dashboard';
    event.waitUntil((async () => {
        const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) {
            if ('focus' in c) {
                await c.focus();
                if ('navigate' in c) return c.navigate(link);
                return;
            }
        }
        return clients.openWindow(link);
    })());
});

// ───────────────────────── Modo offline ─────────────────────────
// Os dados (produtos, vendas…) já ficam no aparelho pelo Firestore. Aqui guardamos a própria
// app (páginas e ficheiros JS/CSS) para ela abrir sem internet.
// Mudar VERSION apaga as caches antigas.
const VERSION = 'v2';
const SHELL = 'msx-shell-' + VERSION;   // páginas
const STATIC = 'msx-static-' + VERSION; // JS, CSS, imagens, fontes
const OFFLINE_URL = '/offline.html';
const PAGE_TIMEOUT_MS = 4000;           // rede lenta: usa a cópia guardada em vez de esperar
const MAX_SHELL_ENTRIES = 80;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(SHELL).then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        for (const k of await caches.keys()) {
            if (k.startsWith('msx-') && k !== SHELL && k !== STATIC) await caches.delete(k);
        }
        await self.clients.claim();
    })());
});

const isCacheable = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

async function trim(cacheName, max) {
    const cache = await caches.open(cacheName);
    const keys = (await cache.keys()).filter((k) => !k.url.endsWith(OFFLINE_URL));
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req) {
    const cache = await caches.open(STATIC);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (isCacheable(res)) cache.put(req, res.clone());
    return res;
}

async function staleWhileRevalidate(req) {
    const cache = await caches.open(STATIC);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => { if (isCacheable(res)) cache.put(req, res.clone()); return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
}

// Páginas (HTML): rede primeiro (para teres sempre a versão nova), cópia guardada se a rede falhar ou for muito lenta.
async function networkFirst(event, isNavigation) {
    const req = event.request;
    const cache = await caches.open(SHELL);
    const lookup = async () => {
        const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: true });
        // uma página só pode ser HTML: nunca mostrar dados internos do Next (text/x-component) como se fossem a página
        return hit && (hit.headers.get('content-type') || '').includes('text/html') ? hit : undefined;
    };
    const net = fetch(req).then((res) => {
        if (isCacheable(res) && (res.headers.get('content-type') || '').includes('text/html')) { cache.put(req, res.clone()).then(() => trim(SHELL, MAX_SHELL_ENTRIES)); }
        return res;
    });
    const fallback = async () => {
        const hit = await lookup();
        if (hit) return hit;
        if (isNavigation) { const off = await cache.match(OFFLINE_URL); if (off) return off; }
        return Response.error();
    };
    const cached = await lookup();
    if (!cached) return net.catch(fallback);
    event.waitUntil(net.catch(() => {}));
    return Promise.race([net, new Promise((r) => setTimeout(() => r(cached), PAGE_TIMEOUT_MS))]).catch(() => cached);
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // Firebase, Blob, Google: nunca interferir
    const p = url.pathname;
    if (p.startsWith('/api/') || p === '/firebase-messaging-sw.js' || p === '/sw.js') return;

    if (p.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(req).catch(() => Response.error()));
    } else if (req.mode === 'navigate') {
        event.respondWith(networkFirst(event, true));
    } else if (url.searchParams.has('_rsc') || req.headers.get('RSC')) {
        return; // dados internos do Next: sem rede, o Next abre a página normal (HTML guardado) em vez de usar cópias
    } else if (['image', 'font', 'style', 'script'].includes(req.destination) || /\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(p)) {
        event.respondWith(staleWhileRevalidate(req).catch(() => Response.error()));
    }
});

// A app pede para "aquecer" as páginas principais depois de entrar, para abrirem offline
// mesmo que ainda não tenham sido visitadas neste aparelho.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'WARM' && Array.isArray(event.data.urls)) {
        event.waitUntil(warm(event.data.urls.filter((u) => typeof u === 'string' && u.startsWith('/')).slice(0, 25)));
    }
});

async function warm(urls) {
    const shell = await caches.open(SHELL);
    const stat = await caches.open(STATIC);
    const assets = new Set();
    for (const u of urls) {
        try {
            const res = await fetch(u, { credentials: 'same-origin' });
            if (!isCacheable(res)) continue;
            await shell.put(u, res.clone());
            const html = await res.text();
            for (const m of html.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s)<>]+/g)) {
                assets.add('/_next/' + m[0].replace(/^\/_next\//, ''));
            }
        } catch (e) { /* sem rede: tenta na próxima vez */ }
    }
    const list = Array.from(assets);
    for (let i = 0; i < list.length; i += 6) {
        await Promise.all(list.slice(i, i + 6).map(async (a) => {
            try {
                if (await stat.match(a)) return;
                const r = await fetch(a);
                if (isCacheable(r)) await stat.put(a, r);
            } catch (e) { /* ignora */ }
        }));
    }
    const all = await self.clients.matchAll();
    all.forEach((c) => c.postMessage({ type: 'WARM_DONE', pages: urls.length, assets: list.length }));
}
