export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/** Hora do servidor (referência para os relógios dos aparelhos). */
export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
