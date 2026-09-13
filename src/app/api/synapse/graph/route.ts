import { NextResponse } from 'next/server';
import { buildSynapseGraph } from '@/lib/synapse-graph-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const graphData = buildSynapseGraph();
    return NextResponse.json({
      status: 'ok',
      data: graphData
    });
  } catch (err: any) {
    console.error('[SynapseGraphRoute] Failed to build graph:', err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to build graph' },
      { status: 500 }
    );
  }
}
