import { NextResponse } from 'next/server';

/**
 * OSIRIS — AI 분석 라우터
 * /api/ai → 하위 엔드포인트 목록 반환
 *
 * 하위 라우트:
 *   /api/ai/analyze   — 이미지·텍스트 인텔 분석
 *   /api/ai/briefing  — 상황 브리핑 생성
 *   /api/ai/overview  — 글로벌 위협 개요
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'OSIRIS AI Intelligence Router',
    version: '1.0.0',
    endpoints: [
      { path: '/api/ai/analyze',  method: 'POST', description: '이미지·텍스트 인텔 분석 (GPT-4o Vision)' },
      { path: '/api/ai/briefing', method: 'GET',  description: '상황 브리핑 자동 생성' },
      { path: '/api/ai/overview', method: 'GET',  description: '글로벌 위협 개요 요약' },
    ],
    timestamp: new Date().toISOString(),
  });
}
