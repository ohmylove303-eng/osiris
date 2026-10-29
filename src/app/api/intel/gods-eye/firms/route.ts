import { NextResponse } from 'next/server';
import { getGodsEyeFirmsGeoJSON } from '@/lib/gods-eye-bridge/firms-thermal-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const geojson = getGodsEyeFirmsGeoJSON();
    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch FIRMS thermal anomalies' },
      { status: 500 }
    );
  }
}
