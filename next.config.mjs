/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Erros de tipos agora quebram o build (antes eram ignorados e escondiam bugs reais).
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  turbopack: {},
  // Entrar com o Google mostra o domínio de autenticação ("Continuar para …"). Para aparecer stock.majorgroup.app em vez
  // de <projecto>.firebaseapp.com, as páginas de autenticação da Firebase são servidas pelo nosso próprio domínio:
  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = stock.majorgroup.app e o Google Cloud com o redirecionamento
  // https://stock.majorgroup.app/__/auth/handler. Sem isso nada muda (estas rotas só ficam disponíveis).
  async rewrites() {
    const origin = process.env.FIREBASE_AUTH_PROXY_ORIGIN
      || `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'atrevamoneytracker'}.firebaseapp.com`;
    return [
      { source: '/__/auth/:path*', destination: `${origin}/__/auth/:path*` },
      { source: '/__/firebase/:path*', destination: `${origin}/__/firebase/:path*` },
    ];
  },
};

// O PWA (service worker) vive em public/firebase-messaging-sw.js e é registado por <PwaRegister />.
// O plugin next-pwa foi removido: não funciona com o Turbopack.
export default nextConfig;
