import { NextResponse } from 'next/server';
import {
  loadBridgeStatus, saveBridgeStatus, getToday, getNextBridgeUpdate,
  type BridgeStatus,
} from '@/lib/harness-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * OSIRIS — Bridge Update Trigger API
 * 
 * GET:  Trigger a full bridge update (both Bridge 1 & 2)
 * POST: Force immediate refresh with status report
 * 
 * Designed to be called by:
 * - Cron job at 06:00 KST daily
 * - Manual trigger from UI
 * - ISR revalidation
 */

async function triggerBridgeUpdate(): Promise<{ bridge1: any; bridge2: any; seismic: any }> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://127.0.0.1:${process.env.PORT || 3000}`;

  // Trigger all bridge APIs in parallel with refresh=true
  const [bridge1Res, seismicRes, starlinkRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/osint/dprk-activity?refresh=true`, { signal: AbortSignal.timeout(45000) }),
    fetch(`${baseUrl}/api/osint/seismic-watch?refresh=true`, { signal: AbortSignal.timeout(20000) }),
    fetch(`${baseUrl}/api/osint/starlink-coverage`, { signal: AbortSignal.timeout(15000) }),
  ]);

  const bridge1 = bridge1Res.status === 'fulfilled' && bridge1Res.value.ok
    ? await bridge1Res.value.json()
    : { status: 'error', error: 'Bridge 1 fetch failed' };

  const seismic = seismicRes.status === 'fulfilled' && seismicRes.value.ok
    ? await seismicRes.value.json()
    : { status: 'error', error: 'Seismic watch fetch failed' };

  const bridge2 = starlinkRes.status === 'fulfilled' && starlinkRes.value.ok
    ? await starlinkRes.value.json()
    : { status: 'error', error: 'Starlink coverage fetch failed' };

  // Save bridge status
  const statuses: BridgeStatus[] = [
    {
      bridge_id: 'bridge-1-dprk',
      last_update: new Date().toISOString(),
      next_scheduled_update: getNextBridgeUpdate(),
      total_events_collected: bridge1.total_activities || 0,
      total_verified: (bridge1.tier_stats?.['TIER-1 VERIFIED'] || 0) + (bridge1.tier_stats?.['CROSS-VERIFIED'] || 0),
      total_unverified: bridge1.tier_stats?.['UNVERIFIED'] || 0,
      sources_queried: bridge1.sources_queried || 0,
      sources_responding: bridge1.sources_responding || 0,
      error_log: bridge1.status === 'error' ? [bridge1.error] : [],
    },
    {
      bridge_id: 'bridge-2-multidomain',
      last_update: new Date().toISOString(),
      next_scheduled_update: getNextBridgeUpdate(),
      total_events_collected: (seismic.total || 0) + (bridge2.total_cells || 0),
      total_verified: seismic.total || 0,
      total_unverified: seismic.nuclear_suspect_count || 0,
      sources_queried: 3, // USGS + IRIS + Starlink
      sources_responding: (seismic.sources?.usgs?.status === 'OK' ? 1 : 0) +
        (seismic.sources?.iris?.status === 'OK' ? 1 : 0) +
        (bridge2.status === 'success' ? 1 : 0),
      error_log: seismic.status === 'error' ? [seismic.error] : [],
    },
  ];

  saveBridgeStatus(statuses);

  return { bridge1, bridge2, seismic };
}

export async function GET() {
  try {
    const results = await triggerBridgeUpdate();

    return NextResponse.json({
      status: 'success',
      message: 'Bridge update completed',
      update_time: new Date().toISOString(),
      accumulated_date: getToday(),
      next_scheduled: getNextBridgeUpdate(),
      summary: {
        bridge_1: {
          activities_collected: results.bridge1.total_activities || 0,
          live_collected: results.bridge1.live_collected || 0,
          curated_baseline: results.bridge1.curated_baseline || 0,
          sources_responding: results.bridge1.sources_responding || 0,
        },
        bridge_2: {
          seismic_events: results.seismic.total || 0,
          nuclear_suspects: results.seismic.nuclear_suspect_count || 0,
          starlink_cells: results.bridge2.total_cells || 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Bridge-Update] Error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Bridge update failed',
      error: String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST() {
  // Force refresh — same as GET but always fresh
  return GET();
}
