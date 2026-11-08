
import './globals.css';
import { AppProviders } from '@/firebase/client-provider';
import type { Metadata, Viewport } from 'next';
import { PT_Sans, Space_Grotesk } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster";
import { ProgressHaulHost } from "@/components/haul/progress-haul";
import { PwaRegister } from "@/components/pwa-register";
import { ErrorReporter } from "@/components/error-reporter";
import { IntroSplash } from "@/components/intro-splash";
import { INTRO_GATE } from "@/lib/intro-gate";
import { LOADER_GATE } from "@/components/layout/app-loader";
import { RELOAD_GATE } from "@/lib/nav-hint";

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-body',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-headline',
});

export const metadata: Metadata = {
  title: 'MajorStockX',
  description: 'Sistema de gestão de estoque e produção para materiais de construção.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/logo.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // iPhone: abre como app (sem a barra do Safari) e com o nome certo no ecrã principal
  appleWebApp: { capable: true, title: 'MajorStockX', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${ptSans.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-body antialiased">
        {/* antes da primeira pintura: se a animação de entrada aparece, em que objecto começa o ecrã de carregamento
            e se é uma recarga com a sessão aberta (só o conteúdo espera) */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE + LOADER_GATE + RELOAD_GATE }} />
        <IntroSplash />
        <AppProviders>{children}</AppProviders>
        <Toaster />
        <ProgressHaulHost />
        <PwaRegister />
        <ErrorReporter />
      </body>
    </html>
  );
}
