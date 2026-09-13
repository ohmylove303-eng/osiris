import { NextResponse } from 'next/server';
import {
  loadBridgeStatus, getNextBridgeUpdate, getToday,
  loadDailyEvents, loadSeismicAlerts,
} from '@/lib/harness-engine';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Bridge Status Dashboard API
 * 
 * Returns comprehensive status of both bridges:
 * - Last update timestamps
 * - Collection statistics
 * - Verification breakdown
 * - Historical daily counts
 */

export async function GET() {
  const statuses = loadBridgeStatus();
  const today = getToday();
  const todayEvents = loadDailyEvents(today);
  const nuclearAlerts = loadSeismicAlerts();

  // Historical daily counts (last 7 days)
  const historicalCounts: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 86400000 + 9 * 3600000);
    const dateStr = date.toISOString().split('T')[0];
    const events = loadDailyEvents(dateStr);
    historicalCounts[dateStr] = events.length;
  }

  // Category breakdown for today
  const categoryBreakdown: Record<string, number> = {};
  const tierBreakdown: Record<string, number> = {};
  for (const ev of todayEvents) {
    categoryBreakdown[ev.category] = (categoryBreakdown[ev.category] || 0) + 1;
    tierBreakdown[ev.verification_tier] = (tierBreakdown[ev.verification_tier] || 0) + 1;
  }

  return NextResponse.json({
    status: 'success',
    bridges: statuses.length > 0 ? statuses : [
      {
        bridge_id: 'bridge-1-dprk',
        last_update: 'Never (run /api/harness/bridge-update first)',
        next_scheduled_update: getNextBridgeUpdate(),
        total_events_collected: todayEvents.length,
        total_verified: todayEvents.filter(e => e.verification_tier === 'TIER-1 VERIFIED' || e.verification_tier === 'CROSS-VERIFIED').length,
        total_unverified: todayEvents.filter(e => e.verification_tier === 'UNVERIFIED').length,
        sources_queried: 0,
        sources_responding: 0,
        error_log: [],
      },
      {
        bridge_id: 'bridge-2-multidomain',
        last_update: 'Never (run /api/harness/bridge-update first)',
        next_scheduled_update: getNextBridgeUpdate(),
        total_events_collected: 0,
        total_verified: 0,
        total_unverified: 0,
        sources_queried: 0,
        sources_responding: 0,
        error_log: [],
      },
    ],
    today: {
      date: today,
      total_activities: todayEvents.length,
      category_breakdown: categoryBreakdown,
      tier_breakdown: tierBreakdown,
    },
    nuclear_alerts: {
      total_historical: nuclearAlerts.length,
      latest: nuclearAlerts.slice(-5),
    },
    historical_daily_counts: historicalCounts,
    next_scheduled_update: getNextBridgeUpdate(),
    system_time: new Date().toISOString(),
    system_time_kst: new Date(Date.now() + 9 * 3600000).toISOString().replace('Z', '+09:00'),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
