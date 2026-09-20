/**
 * OSIRIS Tactical Feeds — Staleness Watchdog (최신화 감독관)
 * 
 * Socratic & Physical Grounding:
 * Monitors all active tactical layers (fires, cables, maritime, notam, etc.)
 * Ensures that if a feed's scheduled update time (next_update_at) passes without a refresh,
 * the watchdog detects the overdue state, triggers an immediate self-healing re-synchronization,
 * and notifies the operator transparently on the HUD.
 */

export interface TemporalMetadata {
  observed_at: string;
  fetched_at: string;
  next_update_at: string;
  interval_seconds: number;
  staleness: 'FRESH' | 'WARM' | 'OVERDUE';
  source_name: string;
  rate_limit_info?: string;
}

export interface WatchedFeed {
  id: string;
  name: string;
  endpoint: string;
  temporal?: TemporalMetadata;
  lastChecked: number;
  isOverdue: boolean;
  overdueSeconds: number;
  consecutiveFailures: number;
  lastRefreshAttempt?: number;
  onRefresh?: () => Promise<void> | void;
}

export interface WatchdogState {
  totalFeeds: number;
  freshCount: number;
  overdueCount: number;
  feeds: {
    id: string;
    name: string;
    endpoint: string;
    isOverdue: boolean;
    overdueSeconds: number;
    nextUpdateAt?: string;
    sourceName?: string;
  }[];
  lastTick: number;
}

class StalenessWatchdog {
  private feeds = new Map<string, WatchedFeed>();
  private timer: any = null;
  private isTicking = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.start();
    }
  }

  public registerFeed(
    id: string,
    name: string,
    endpoint: string,
    temporal?: TemporalMetadata,
    onRefresh?: () => Promise<void> | void
  ) {
    const existing = this.feeds.get(id);
    this.feeds.set(id, {
      id,
      name,
      endpoint,
      temporal,
      lastChecked: Date.now(),
      isOverdue: false,
      overdueSeconds: 0,
      consecutiveFailures: existing ? existing.consecutiveFailures : 0,
      onRefresh: onRefresh || existing?.onRefresh,
    });
    this.checkFeeds();
  }

  public updateTemporal(id: string, temporal: TemporalMetadata) {
    const feed = this.feeds.get(id);
    if (feed) {
      feed.temporal = temporal;
      feed.isOverdue = false;
      feed.overdueSeconds = 0;
      feed.consecutiveFailures = 0;
      feed.lastChecked = Date.now();
      this.broadcastState();
    }
  }

  public unregisterFeed(id: string) {
    this.feeds.delete(id);
    this.broadcastState();
  }

  public async forceRefresh(id: string) {
    const feed = this.feeds.get(id);
    if (feed && feed.onRefresh) {
      feed.lastRefreshAttempt = Date.now();
      try {
        await feed.onRefresh();
        feed.consecutiveFailures = 0;
      } catch (e) {
        feed.consecutiveFailures++;
        console.warn(`[Watchdog] Force refresh failed for ${id}:`, e);
      }
      this.broadcastState();
    }
  }

  public async forceRefreshAll() {
    const promises = Array.from(this.feeds.values()).map(f => this.forceRefresh(f.id));
    await Promise.allSettled(promises);
  }

  private start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkFeeds(), 5000);
  }

  private async checkFeeds() {
    if (this.isTicking) return;
    this.isTicking = true;
    const now = Date.now();

    for (const feed of this.feeds.values()) {
      if (!feed.temporal?.next_update_at) continue;

      const nextUpdateMs = new Date(feed.temporal.next_update_at).getTime();
      const toleranceMs = 15000; // 15-second grace period

      if (now > nextUpdateMs + toleranceMs) {
        feed.isOverdue = true;
        feed.overdueSeconds = Math.round((now - nextUpdateMs) / 1000);

        // Auto re-sync: if not refreshed in last 20 seconds, trigger re-fetch
        if (!feed.lastRefreshAttempt || now - feed.lastRefreshAttempt > 20000) {
          feed.lastRefreshAttempt = now;
          if (feed.onRefresh) {
            console.log(`[Watchdog] ⚠️ 최신화 지연 감지 (${feed.name} +${feed.overdueSeconds}초) — 자동 재동기화 시도 중`);
            try {
              await feed.onRefresh();
            } catch (err) {
              feed.consecutiveFailures++;
              console.warn(`[Watchdog] Auto re-sync failed for ${feed.name}:`, err);
            }
          }
        }
      } else {
        feed.isOverdue = false;
        feed.overdueSeconds = 0;
      }
    }

    this.broadcastState();
    this.isTicking = false;
  }

  public getState(): WatchdogState {
    const feedList = Array.from(this.feeds.values());
    const overdueList = feedList.filter(f => f.isOverdue);

    return {
      totalFeeds: feedList.length,
      freshCount: feedList.length - overdueList.length,
      overdueCount: overdueList.length,
      feeds: feedList.map(f => ({
        id: f.id,
        name: f.name,
        endpoint: f.endpoint,
        isOverdue: f.isOverdue,
        overdueSeconds: f.overdueSeconds,
        nextUpdateAt: f.temporal?.next_update_at,
        sourceName: f.temporal?.source_name,
      })),
      lastTick: Date.now(),
    };
  }

  private broadcastState() {
    if (typeof window === 'undefined') return;
    const state = this.getState();
    window.dispatchEvent(new CustomEvent('osiris:watchdog-update', { detail: state }));
  }
}

// Global singleton instance
export const watchdog = new StalenessWatchdog();
