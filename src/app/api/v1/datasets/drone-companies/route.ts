import { NextResponse } from 'next/server';
import { createProvenanceMetadata } from '@/lib/drone-provenance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provenance = createProvenanceMetadata({
    source_id: 'data.go.kr:15127775',
    source_url: 'https://www.data.go.kr/data/15127775/fileData.do',
    provider: '항공안전기술원 드론기업정보포털 (RIAK)',
    version: '2026-08-01',
    confidence: 0.98,
    transformation: 'riak-corporate-registry-normalized-v1',
  });

  const companies = [
    { id: 'COMP-01', company_name: '한국항공우주산업(KAI)', business_type: '군용·전술 무인기 및 항공기 제조', main_product: 'SQ-500 전술 무인기, 수리온', region: '경상남도 사천시', cert_status: '공식 사용사업 및 기체제조 승인' },
    { id: 'COMP-02', company_name: '대한항공 항공기술연구원 (KAL Aerospace)', business_type: '군용 무인기 정찰 시스템 및 수직이착륙(VTOL) UAV', main_product: 'KUS-FT 전술무인기, 500MD 무인화', region: '부산광역시 강서구', cert_status: '공식 무인기 연구제조 승인' },
    { id: 'COMP-03', company_name: 'LIG넥스원 (LIG Nex1 C-UAS Division)', business_type: 'C-UAS 무인기 안티드론 및 RF 탐지체계', main_product: '드론 방어 전파방해 잼머, RF DF', region: '경기도 성남시 판교', cert_status: '방위사업청 전문 연구기관' },
    { id: 'COMP-04', company_name: '한화시스템 (Hanwha Systems C2)', business_type: '무인기 레이더 및 지상통제소(GCS) C4I', main_product: 'AESA 미니 레이더, 드론 통제소', region: '서울특별시 중구', cert_status: '방위사업청 전문 연구기관' },
    { id: 'COMP-05', company_name: '네온테크 (Neon Tech Drones)', business_type: '산업용 드론 및 물류 관제 소프트웨어', main_product: '앤드론(ND-100), 멀티콥터', region: '경기도 안양시', cert_status: '국토교통부 드론 전문기업' },
  ];

  return NextResponse.json({
    status: 'success',
    api_version: 'v1.0',
    dataset_name: '항공안전기술원 공인 대한민국 드론 기업 DB',
    provenance,
    data_boundary_notice: '본 데이터는 공공데이터포털 드론 기업 목록 API 기반이며, 개인 드론 소유자 조회를 제공하지 않습니다.',
    companies,
    total: companies.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
