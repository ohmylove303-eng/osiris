import { NextResponse } from 'next/server';
import { getAllDemarcationGeoJSON } from '@/lib/demarcation-boundaries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const boundaries = getAllDemarcationGeoJSON();

  return NextResponse.json({
    status: 'success',
    system_name: 'OSIRIS 한·중·북 육상·공중·해상 군사분계선 및 방공식별구역 GIS DB',
    boundaries,
    total: boundaries.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
