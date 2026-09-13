import { NextResponse } from 'next/server';
import { checkAirspaceFeasibility } from '@/lib/airspace-rules-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get('lat') || searchParams.get('latitude') || '37.5600';
  const lngStr = searchParams.get('lng') || searchParams.get('lon') || searchParams.get('longitude') || '126.6200';
  const altStr = searchParams.get('alt_m') || searchParams.get('altitude') || '50';

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const alt_m = parseFloat(altStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({
      status: 'error',
      message: 'Invalid latitude or longitude parameter',
    }, { status: 400 });
  }

  const result = checkAirspaceFeasibility(lat, lng, alt_m);

  return NextResponse.json({
    status: 'success',
    api_version: 'v1.0',
    data_boundary_notice: '공개 공공데이터 및 법령 규칙 기반 판정 (개인 소유자 정보 제외)',
    ...result,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
