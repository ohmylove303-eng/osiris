import { NextRequest, NextResponse } from 'next/server';
import { upsertVectorDocuments, loadVectorStore, VectorDocument } from '@/lib/local-rag-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = loadVectorStore();
    const categories: Record<string, number> = {};
    for (const doc of store) {
      const cat = doc.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return NextResponse.json({
      status: 'ok',
      totalDocuments: store.length,
      categories,
      lastUpdated: new Date().toISOString(),
      recentDocuments: store.slice(-15).reverse().map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        contentPreview: d.content ? d.content.slice(0, 160) + '...' : '',
        metadata: d.metadata,
      })),
      sampleTitles: store.slice(-5).map((d) => ({ id: d.id, title: d.title, category: d.category })),
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      title,
      content,
      source_org,
      source_url = 'https://osiris.tactical/user-verified',
      category = 'user_verified_intel',
      date = new Date().toISOString().split('T')[0],
      mgrs = '52SCA0000000000',
      verification_tier = 'TIER-1 (FACT)',
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required and must be non-empty' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required and must be non-empty' }, { status: 400 });
    }
    if (!source_org || typeof source_org !== 'string' || !source_org.trim()) {
      return NextResponse.json({ error: 'source_org (출처 기관) is required' }, { status: 400 });
    }

    const docId = `verified-ingest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newDoc: Omit<VectorDocument, 'embedding'> = {
      id: docId,
      title: title.trim(),
      category: category.trim(),
      content: content.trim(),
      metadata: {
        source_org: source_org.trim(),
        source_url: source_url.trim(),
        date,
        mgrs,
        verification_tier,
        verification_score: 1.0,
      },
    };

    const result = await upsertVectorDocuments([newDoc]);
    const store = loadVectorStore();

    return NextResponse.json({
      status: 'ok',
      message: '지식 벡터화 및 RAG 영구 인덱싱 완료 (nomic-embed-text 768D)',
      documentId: docId,
      upsertResult: result,
      totalDocumentsInStore: store.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[IngestVerified] failed:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'RAG ingestion failed' },
      { status: 500 }
    );
  }
}
