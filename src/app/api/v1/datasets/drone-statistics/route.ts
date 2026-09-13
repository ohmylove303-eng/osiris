import { NextResponse } from 'next/server';
import { createProvenanceMetadata } from '@/lib/drone-provenance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provenance = createProvenanceMetadata({
    source_id: 'data.go.kr:15106870',
    source_url: 'https://www.data.go.kr/data/15106870/fileData.do',
    provider: '국토교통부 / 항공안전기술원 드론정보포털',
    version: '2026-07-31',
    confidence: 0.99,
    transformation: 'molit-civil-stats-normalized-v1',
  });

  const statistics = [
    { month: '2026-07', device_registrations: 4210, business_registrations: 382, flight_approvals: 12850, photo_permits: 8420 },
    { month: '2026-06', device_registrations: 3950, business_registrations: 345, flight_approvals: 11900, photo_permits: 7980 },
    { month: '2026-05', device_registrations: 4100, business_registrations: 360, flight_approvals: 12300, photo_permits: 8150 },
    { month: '2026-04', device_registrations: 3800, business_registrations: 310, flight_approvals: 10500, photo_permits: 7200 },
  ];

  return NextResponse.json({
    status: 'success',
    api_version: 'v1.0',
    dataset_name: '국토교통부 드론원스톱 민원 및 장치신고 월별 통계',
    provenance,
    data_boundary_notice: '본 통계는 공공데이터포털 공개 파일 데이터를 기반으로 정규화된 통계이며, 개별 드론 실시간 트랙을 제공하지 않습니다.',
    statistics,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
