import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawKey = process.env.DATA_GO_KR_API_KEY || process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY || '';
  const isSet = Boolean(rawKey.trim());
  
  // 마스킹된 키 반환
  const maskedKey = isSet 
    ? `${rawKey.slice(0, 6)}...${rawKey.slice(-6)}`
    : '';

  return NextResponse.json({
    isSet,
    maskedKey,
    urls: {
      tagoBus: 'https://www.data.go.kr/data/15000551/openapi.do',
      gyeonggiBus: 'https://www.data.go.kr/data/15080662/openapi.do',
    }
  });
}

export async function POST(req: Request) {
  try {
    let { apiKey } = await req.json();
    let isCurrentTest = false;

    if (apiKey === '__CURRENT__') {
      apiKey = process.env.DATA_GO_KR_API_KEY || process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY || '';
      isCurrentTest = true;
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json({ error: '유효한 공공데이터포털 일반 인증키를 입력해주세요.' }, { status: 400 });
    }

    const trimmedKey = apiKey.trim();

    // 1. 공공데이터 TAGO 버스 API 실시간 연결 검증 테스트
    const decodedKey = decodeURIComponent(trimmedKey);
    const testUrl = `http://apis.data.go.kr/1613000/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=${encodeURIComponent(decodedKey)}&cityCode=31230&routeId=GMB30000001&_type=json`;

    let testResult = 'unknown';
    try {
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      const reasonCode = data?.response?.header?.returnReasonCode || data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
      if (reasonCode === '00' || data?.response?.body) {
        testResult = 'VERIFIED_ACTIVE';
      } else if (reasonCode === '30') {
        testResult = 'NOT_REGISTERED_YET'; // 활용신청 후 1~2시간 동기화 필요 또는 미신청
      } else {
        testResult = reasonCode || 'RESPONSE_OK';
      }
    } catch {
      testResult = 'TIMEOUT_OR_NETWORK';
    }

    // 2. .env.local 파일에 DATA_GO_KR_API_KEY 저장 (새 키를 입력했을 때만 수행)
    if (!isCurrentTest) {
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (envContent.includes('DATA_GO_KR_API_KEY=')) {
        envContent = envContent.replace(/DATA_GO_KR_API_KEY=.*/, `DATA_GO_KR_API_KEY=${trimmedKey}`);
      } else {
        envContent += `\nDATA_GO_KR_API_KEY=${trimmedKey}\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
      process.env.DATA_GO_KR_API_KEY = trimmedKey;
    }

    let message = '';
    if (testResult === 'VERIFIED_ACTIVE') {
      message = '🎉 공공데이터포털 TAGO 실시간 버스 API가 성공적으로 인증되어 활성화되었습니다!';
    } else if (testResult === 'NOT_REGISTERED_YET') {
      message = '⏳ 활용신청은 접수되었으나, 공공데이터포털 중앙 서버에서 키 동기화 작업이 진행 중입니다. (약 10~30분 소요, 완료 시 자동 전환)';
    } else {
      message = isCurrentTest 
        ? `포털 응답 상태: ${testResult}`
        : 'API 키가 로컬 .env.local에 안전하게 저장되었습니다.';
    }

    return NextResponse.json({
      success: true,
      testResult,
      message
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '저장 실패' }, { status: 500 });
  }
}
