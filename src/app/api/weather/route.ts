export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Maputo por defeito. Guardado 10 min para não consultar o serviço a cada ecrã.
let cache: { at: number; key: string; temp: number } | null = null;

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const lat = Number(u.searchParams.get('lat') ?? -25.97);
    const lon = Number(u.searchParams.get('lon') ?? 32.57);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
    }
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (cache && cache.key === key && Date.now() - cache.at < 10 * 60_000) return NextResponse.json({ temp: cache.temp });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'Sem dados.' }, { status: 502 });
    const j = await r.json();
    const temp = Number(j?.current?.temperature_2m);
    if (!Number.isFinite(temp)) return NextResponse.json({ error: 'Sem dados.' }, { status: 502 });
    cache = { at: Date.now(), key, temp };
    return NextResponse.json({ temp });
  } catch {
    return NextResponse.json({ error: 'Sem dados.' }, { status: 502 });
  }
}
