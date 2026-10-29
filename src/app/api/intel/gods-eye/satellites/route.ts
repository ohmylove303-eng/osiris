import { NextResponse } from 'next/server';
import { getGodsEyeSatellitesGeoJSON } from '@/lib/gods-eye-bridge/satellite-orbit-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const geojson = getGodsEyeSatellitesGeoJSON(new Date());
    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to propagate satellites' },
      { status: 500 }
    );
  }
}
