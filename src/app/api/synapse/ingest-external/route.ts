import { NextRequest, NextResponse } from 'next/server';
import { parseExternalLlmText, saveToObsidianVaultAndVectorize } from '@/lib/external-llm-parser';
import { buildSynapseGraph } from '@/lib/synapse-graph-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { rawText, customTitle, sourceUrl } = body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json(
        { status: 'error', message: 'rawText (ChatGPT 또는 Perplexity 연구 본문)는 필수입니다.' },
        { status: 400 }
      );
    }

    // 1. 파싱 및 메타데이터, 위키링크 추출
    const parsed = parseExternalLlmText(rawText, customTitle, sourceUrl);

    // 2. 옵시디언 볼트 .md 저장 및 768D 벡터화
    const result = await saveToObsidianVaultAndVectorize(parsed);

    // 3. 갱신된 그래프 통계 계산
    const updatedGraph = buildSynapseGraph();

    return NextResponse.json({
      status: 'ok',
      message: `${parsed.sourceOrg} 연구 데이터가 옵시디언 볼트 및 RAG 벡터 DB에 인덱싱되었습니다.`,
      result,
      graphStats: updatedGraph.stats
    });
  } catch (err: any) {
    console.error('[IngestExternalRoute] Failed:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || '인제스천 처리 실패' },
      { status: 500 }
    );
  }
}
