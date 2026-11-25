export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/** Versão que o servidor está a servir (o ecrã compara com a sua e recarrega se estiver desatualizado). */
export async function GET() {
  return NextResponse.json({ build: process.env.NEXT_PUBLIC_BUILD_ID || 'dev' }, { headers: { 'Cache-Control': 'no-store' } });
}
