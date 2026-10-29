import { NextResponse } from 'next/server';
import { ROK_MILITARY_SITES, getRokMilitaryGeoJson } from '@/lib/rok-military-sites';

export const dynamic = 'force-dynamic';

export async function GET() {
  const geojson = getRokMilitaryGeoJson();
  return NextResponse.json({
    status: 'OK',
    total: ROK_MILITARY_SITES.length,
    sites: ROK_MILITARY_SITES,
    geojson,
    timestamp: new Date().toISOString()
  });
}
