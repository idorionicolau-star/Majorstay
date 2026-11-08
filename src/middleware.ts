import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // Security Headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set(
        'Permissions-Policy',
        'camera=(self), microphone=(self), geolocation=()'
    );

    // Entrar com o Google (signInWithPopup): a Firebase carrega o gapi de apis.google.com e abre um iframe
    // escondido no domínio de autenticação (<projecto>.firebaseapp.com ou o NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN).
    // Sem isto o login com o Google falha com "auth/internal-error".
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const authFrames = ['https://*.firebaseapp.com', 'https://*.web.app', 'https://accounts.google.com', 'https://apis.google.com', ...(authDomain ? [`https://${authDomain}`] : [])].join(' ');

    // Content Security Policy (CSP)
    response.headers.set(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://*.firebase.com https://*.firebaseapp.com https://apis.google.com https://accounts.google.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://vercel.com https://*.vercel-storage.com", // vercel: envio de fotos (Blob)
            "worker-src 'self' blob:",
            `frame-src 'self' blob: ${authFrames}`,
            "frame-ancestors 'none'",
        ].join('; ')
    );

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - __/ (páginas de autenticação da Firebase servidas pelo nosso domínio: o iframe delas não pode levar
         *   o X-Frame-Options DENY nem a CSP daqui — trazem os cabeçalhos da própria Firebase)
         */
        '/((?!_next/static|_next/image|favicon.ico|__/).*)',
    ],
};
